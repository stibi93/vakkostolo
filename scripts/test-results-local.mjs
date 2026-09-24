// Opt-in LOCAL Supabase probe. Uses only temporary synthetic accounts and cleans
// them up. No keys/tokens/user data are logged; the admin client stays in Node.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { URL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { signInLocalSuperadmin } from './local-superadmin.mjs';
let config;
try { config = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
catch { throw new Error('Indítsd el a helyi Supabase stacket, és alkalmazd a migrációkat.'); }
if (!['127.0.0.1', 'localhost'].includes(new URL(config.API_URL).hostname)) throw new Error('Csak helyi Supabase tesztelhető.');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const clients = Array.from({ length: 5 }, () => createClient(config.API_URL, config.ANON_KEY, options));
const ids = [];
function ensure(condition, text) { if (!condition) throw new Error(text); }
function data(result, label) { ensure(!result.error, `${label}: sikertelen kérés (${result.error?.code ?? 'ismeretlen'})`); return result.data; }
async function until(predicate, label) {
  const until = Date.now() + 12_000;
  while (!predicate()) { ensure(Date.now() < until, `${label}: időtúllépés`); await delay(100); }
}
async function watch(client, game, count) {
  let ready = false;
  const channel = client.channel(`round-probe:${randomUUID()}`, { config: { postgres_changes_options: { wait: true } } })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `game_id=eq.${game}` }, count)
    .subscribe(status => { ready = status === 'SUBSCRIBED'; });
  await until(() => ready, 'Realtime'); return channel;
}
try {
  const [host, peer, one, two, outsider] = clients;
  const hostUser = await signInLocalSuperadmin(admin, host, 'round'), session = hostUser.session;
  ids.push(hostUser.id);
  data(await peer.auth.setSession(session), 'Második hostkapcsolat');
  for (const client of [one, two, outsider]) ids.push(data(await client.auth.signInAnonymously(), 'Anonim Auth').user.id);
  const game=data(await host.rpc('create_game',{p_request_id:randomUUID(),p_title:'Automatikus eredménypróba',p_round_seconds:120,p_reveal_every:1,
    p_wines:[{name:'Próba Furmint',price_huf:5000,alcohol_tenths:135},{name:'Még titkos második',price_huf:7500,alcohol_tenths:125}]}),'Játék');
  const invite=data(await host.rpc('issue_invite',{p_game_id:game}),'Meghívó');
  for(const [client,name] of [[one,'Anna'],[two,'Béla']]) data(await client.rpc('join_game',{p_token:invite.token,p_nickname:name}),'Tagság');
  const plan=()=>host.rpc('get_tasting_schedule',{p_game_id:game}).then(r=>data(r,'Menet'));
  const result=client=>client.rpc('get_game_results',{p_game_id:game}).then(r=>data(r,'Eredmény'));
  const act=async action=>host.rpc('control_tasting',{p_game_id:game,p_expected_version:(await plan()).version,p_request_id:randomUUID(),p_action:action}).then(r=>data(r,action));
  const agenda=await plan();
  data(await host.rpc('save_tasting_schedule',{p_game_id:game,p_expected_version:agenda.version,p_request_id:randomUUID(),
    p_steps:agenda.steps.flatMap(w=>[w,{id:randomUUID(),kind:'reveal',title:'Bemutató',message:'',seconds:0,reveal_round_ids:[w.id]}])}),'Felfedési kártyák');
  const round=(await plan()).steps[0].id,path=`${game}/${round}.jpg`;
  const photo=await readFile(new URL('../public/images/blind-tasting-table.jpg',import.meta.url));
  data(await host.storage.from('wine-photos').upload(path,photo,{contentType:'image/jpeg'}),'Szintetikus fotó');
  try {
    ensure((await one.storage.from('wine-photos').download(path)).error,'Fotó olvasható felfedés előtt');
    ensure((await result(one)).wines.length===0,'Korai eredmény');
    await act('start');
    for(const [client,bucket,alcohol,liking] of [[one,5,135,10],[two,6,140,6]]) data(await client.rpc('submit_rating',{
      p_round_id:round,p_price_bucket:bucket,p_alcohol_tenths:alcohol,p_liking:liking}),'Tipp');
    await act('close');ensure((await result(one)).wines.length===0,'Lezárás felfedett');
    let changed=0;await watch(one,game,()=>changed++);await act('reveal');await until(()=>changed>0,'Felfedés Realtime');
    const a=await result(one),b=await result(two),shared=await result(host);
    ensure(a.wines[0].own.total===100 && b.wines[0].own.total===67,'Hibás saját pont');
    ensure(shared.wines[0].own===null,'Host személyes választ kapott');
    ensure(a.wines[0].average_liking===8 && a.wines.length===1,'Hibás közös eredmény');
    ensure(!JSON.stringify(a).includes('Még titkos második'),'Következő bor kiszivárgott');
    const downloaded=data(await one.storage.from('wine-photos').download(path),'Felfedett fotó');
    ensure(downloaded.size===photo.length,'Fotó méreteltérés');
    ensure((await outsider.storage.from('wine-photos').download(path)).error,'Idegen fotóhozzáférés');
    ensure((await outsider.rpc('get_game_results',{p_game_id:game})).error?.message==='GAME_NOT_FOUND','Idegen eredményhozzáférés');
    const snapshot=data(await one.rpc('get_game_snapshot',{p_game_id:game}),'Integrált snapshot');
    ensure(snapshot.results.wines[0].photo_updated_at && snapshot.results.wines[0].own.total===100,'Snapshot nem hordoz eredményt és fotót');
    await act('next');await act('close');await act('reveal');await act('finish');
    ensure((await result(one)).final && (await result(one)).wines[1].average_liking===null,'Végső eredmény hibás');
    process.stdout.write('Helyi eredménypróba: szerverpontok, saját/közös DTO, Realtime, fotó felfedés előtti tiltása és utáni letöltése, idegen hozzáférés és végső állapot sikeres.\n');
  } finally { data(await admin.storage.from('wine-photos').remove([path]),'Fotótakarítás'); }

} finally {
  for (const client of clients) { await client.removeAllChannels(); client.auth.stopAutoRefresh(); }
  for (const id of ids) data(await admin.auth.admin.deleteUser(id), 'Tesztadat-takarítás');
  admin.auth.stopAutoRefresh(); process.stdout.write('A saját szintetikus tesztfelhasználók és játékadatok törölve.\n');
}
