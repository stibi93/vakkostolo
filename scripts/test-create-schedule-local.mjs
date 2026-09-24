// Synthetic local-only check of atomic game + agenda creation.
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {signInLocalSuperadmin} from './local-superadmin.mjs';
const config=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
if(!['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname)) throw new Error('Csak helyi Supabase tesztelhető.');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options),host=createClient(config.API_URL,config.ANON_KEY,options);
let userId;
function data(r) {if(r.error) throw new Error(r.error.message);return r.data;}
try {
 userId=(await signInLocalSuperadmin(admin,host,'create-schedule')).id;
 const args={p_request_id:randomUUID(),p_title:'Szintetikus teljes menet',p_round_seconds:0,p_reveal_every:2,
  p_wines:[{name:'Próbabor',price_huf:4500,alcohol_tenths:130}],
  p_steps:[{kind:'break',title:'Köszöntő',message:'Indulunk',seconds:0},{kind:'wine',wine_index:0},
   {kind:'reveal',title:'Bemutató',message:'Egy bor',wine_indexes:[0]}]};
 const attempts=await Promise.all([host.rpc('create_game_with_schedule',args),host.rpc('create_game_with_schedule',args)]);
 const game=data(attempts[0]);if(data(attempts[1])!==game) throw new Error('Duplázott létrehozás');
 const details=data(await host.rpc('get_host_game',{p_game_id:game}));
 if(details.schedule.steps.map(s=>s.kind).join(',')!=='break,wine,reveal') throw new Error('Hibás menet');
 if(details.schedule.steps[2].reveal_round_ids[0]!==details.wines[0].round_id) throw new Error('Hibás felfedés');
 const invalid=await host.rpc('create_game_with_schedule',{...args,p_request_id:randomUUID(),p_steps:[args.p_steps[2],args.p_steps[1]]});
 if(!invalid.error || data(await host.rpc('list_host_games')).length!==1) throw new Error('Nem atomi a mentés');
 console.log('Új teljes menet: kezdő szünet, bor és felfedés; párhuzamos ismétlés és hibás mentés visszagörgetése sikeres.');
} finally {
 if(userId) data(await admin.auth.admin.deleteUser(userId));
 host.auth.stopAutoRefresh();admin.auth.stopAutoRefresh();
 console.log('Saját szintetikus próbaadatok törölve.');
}
