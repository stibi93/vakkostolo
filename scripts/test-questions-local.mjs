// Local Supabase Auth/RPC integration; synthetic users only, removed in finally.
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {signInLocalSuperadmin} from './local-superadmin.mjs';
const config=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
if(!['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname)) throw new Error('Csak helyi Supabase tesztelhető.');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options),host=createClient(config.API_URL,config.ANON_KEY,options),guest=createClient(config.API_URL,config.ANON_KEY,options);
const ids=[];
function data(r) {if(r.error) throw new Error(r.error.message);return r.data;}
const question={id:'country',prompt:'Melyik országból származik?',options:[{id:'hu',label:'Magyarország'},{id:'it',label:'Olaszország'}],correctOptionId:'hu'};
try {
 ids.push((await signInLocalSuperadmin(admin,host,'questions')).id);
 ids.push(data(await guest.auth.signInAnonymously()).user.id);
 const game=data(await host.rpc('create_game_with_schedule',{p_request_id:randomUUID(),p_title:'Szintetikus kérdéspróba',p_round_seconds:0,p_reveal_every:2,
  p_wines:[{name:'Titkos próbabor',price_huf:4500,alcohol_tenths:130,questions:[question]}],
  p_steps:[{kind:'wine',wine_index:0},{kind:'reveal',title:'Bemutató',wine_indexes:[0]}]}));
 let plan=data(await host.rpc('get_tasting_schedule',{p_game_id:game}));assert.deepEqual(plan.steps[0].questions,[question]);const round=plan.steps[0].id;
 const invite=data(await host.rpc('issue_invite',{p_game_id:game}));data(await guest.rpc('join_game',{p_token:invite.token,p_nickname:'Próbavendég'}));
 async function command(action) {plan=data(await host.rpc('get_tasting_schedule',{p_game_id:game}));data(await host.rpc('control_tasting',{p_game_id:game,p_expected_version:plan.version,p_request_id:randomUUID(),p_action:action}));}
 await command('start');
 let snapshot=data(await guest.rpc('get_game_snapshot',{p_game_id:game}));assert.equal(snapshot.round.questions.length,1);assert.ok(!JSON.stringify(snapshot).includes('correctOptionId'));assert.ok(!JSON.stringify(snapshot).includes('Titkos próbabor'));
 const args={p_round_id:round,p_price_bucket:5,p_alcohol_tenths:130,p_liking:8};
 assert.equal((await guest.rpc('submit_rating',args)).error?.message,'INVALID_ANSWERS');
 data(await guest.rpc('submit_rating_with_questions',{...args,p_answers:{country:'it'}}));
 data(await guest.rpc('submit_rating_with_questions',{...args,p_answers:{country:'hu'}}));
 snapshot=data(await guest.rpc('get_game_snapshot',{p_game_id:game}));assert.deepEqual(snapshot.own_rating.custom_answers,{country:'hu'});
 await command('close');assert.equal((await guest.rpc('submit_rating_with_questions',{...args,p_answers:{country:'it'}})).error?.message,'ROUND_NOT_OPEN');
 await command('next');
 snapshot=data(await guest.rpc('get_game_snapshot',{p_game_id:game}));assert.deepEqual(snapshot.results.wines[0].questions,[{...question,ownOptionId:'hu'}]);assert.equal(snapshot.results.leaderboard[0].points,100);
 const hostResult=data(await host.rpc('get_game_results',{p_game_id:game}));assert.equal(hostResult.wines[0].questions[0].ownOptionId,null);
 console.log('Egyedi kérdések: létrehozás, Auth, titokvédelem, beküldés/felülírás, lezárás és kártyás kiértékelés sikeres.');
} finally {
 for(const id of ids.reverse()) data(await admin.auth.admin.deleteUser(id));
 for(const client of [host,guest,admin]) client.auth.stopAutoRefresh();
 console.log('Saját szintetikus próbaadatok törölve.');
}
