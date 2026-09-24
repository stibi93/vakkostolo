// Local-only Storage + schedule integration; only synthetic records are created.
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { signInLocalSuperadmin } from './local-superadmin.mjs';
const config = JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
if (!['localhost','127.0.0.1'].includes(new URL(config.API_URL).hostname)) throw new Error('Csak helyi Supabase tesztelhető.');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options);
const host=createClient(config.API_URL,config.ANON_KEY,options), guest=createClient(config.API_URL,config.ANON_KEY,options);
const ids=[],paths=[];
function data(result,label) { if(result.error) throw new Error(`${label}: sikertelen kérés`); return result.data; }
function ensure(ok,label) {if(!ok) throw new Error(label);}
try {
  ids.push((await signInLocalSuperadmin(admin,host,'photos')).id);
  ids.push(data(await guest.auth.signInAnonymously(),'Vendég').user.id);
  const game=data(await host.rpc('create_game',{p_request_id:randomUUID(),p_title:'Fotó integráció',p_round_seconds:120,p_reveal_every:1,p_wines:[{name:'Szintetikus bor',price_huf:4500,alcohol_tenths:130}]}),'Játék');
  const details=data(await host.rpc('get_host_game',{p_game_id:game}),'Részletek');
  const round=details.wines[0].round_id,path=`${game}/${round}.jpg`; paths.push(path);
  const fixture=await readFile('public/images/harvest-grapes.jpg');
  const file=new Blob([fixture],{type:'image/jpeg'});
  data(await host.storage.from('wine-photos').upload(path,file,{contentType:'image/jpeg'}),'Feltöltés');
  data(await host.storage.from('wine-photos').createSignedUrl(path,60),'Host megtekintés');
  const invite=data(await host.rpc('issue_invite',{p_game_id:game}),'Meghívó');
  data(await guest.rpc('join_game',{p_token:invite.token,p_nickname:'Fotópróba'}),'Tagság');
  ensure((await guest.storage.from('wine-photos').createSignedUrl(path,60)).error,'Rejtett kép kiszivárgott');
  data(await host.storage.from('wine-photos').upload(path,file,{upsert:true,contentType:'image/jpeg'}),'Csere');
  data(await host.storage.from('wine-photos').remove([path]),'Törlés');
  ensure((await host.storage.from('wine-photos').createSignedUrl(path,60)).error,'Törölt fotó elérhető');
  data(await host.storage.from('wine-photos').upload(path,file,{contentType:'image/jpeg'}),'Új feltöltés');
  const plan=async()=>data(await host.rpc('get_tasting_schedule',{p_game_id:game}),'Menet');
  for(const action of ['start','close','reveal']) data(await host.rpc('control_tasting',{p_game_id:game,p_expected_version:(await plan()).version,p_request_id:randomUUID(),p_action:action}),'Vezérlés');
  const signed=data(await guest.storage.from('wine-photos').createSignedUrl(path,60),'Felfedett fotó');
  ensure((await fetch(signed.signedUrl)).ok,'Felfedett fotó letöltése sikertelen');
  ensure((await host.storage.from('wine-photos').upload(path,file,{upsert:true,contentType:'image/jpeg'})).error,'Felfedett fotó cserélhető');
  console.log('Helyi Storage: feltöltés, csere, törlés, rejtett hozzáférés tiltása, valódi felfedés utáni megtekintés és zárolás sikeres.');
} finally {
  if(paths.length) {
    let removed;
    for(let attempt=0;attempt<3;attempt++) {
      removed=await admin.storage.from('wine-photos').remove(paths);
      if(!removed.error) break;
      if(attempt<2) await delay(500);
    }
    data(removed,'Fotók takarítása');
  }
  for(const id of ids) data(await admin.auth.admin.deleteUser(id),'Tesztfiók takarítása');
  await host.removeAllChannels();await guest.removeAllChannels();
  console.log('Saját szintetikus fotók és tesztadatok törölve.');
}
