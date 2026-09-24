// Opt-in LOCAL Supabase probe. Uses only temporary synthetic accounts and cleans
// them up. No keys/tokens/user data are logged; the admin client stays in Node.
import { execFileSync } from 'node:child_process';
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
  const game = data(await host.rpc('create_game', { p_request_id: randomUUID(), p_title: 'Automatikus menetpróba',
    p_round_seconds: 120, p_reveal_every: 2, p_wines: [1,2].map(i=>({name:`Titkos próba ${i}`,price_huf:4500,alcohol_tenths:130})) }), 'Játék');
  const invite=data(await host.rpc('issue_invite',{p_game_id:game}),'Meghívó');
  data(await one.rpc('join_game',{p_token:invite.token,p_nickname:'Próba'}),'Tagság');
  const plan=()=>host.rpc('get_tasting_schedule',{p_game_id:game}).then(r=>data(r,'Menet'));
  const snap=()=>one.rpc('get_game_snapshot',{p_game_id:game}).then(r=>data(r,'Snapshot'));
  const act=async(action,seconds)=>host.rpc('control_tasting',{p_game_id:game,p_expected_version:(await plan()).version,p_request_id:randomUUID(),p_action:action,...(seconds===undefined?{}:{p_seconds:seconds})}).then(r=>data(r,action));
  const original=await plan(), pause={id:randomUUID(),kind:'break',title:'Víz és kenyér',message:'Egyedi átvezetés',seconds:300};
  const input=[original.steps[0],pause,original.steps[1]];
  const saves=await Promise.all([host,peer].map(c=>c.rpc('save_tasting_schedule',{p_game_id:game,p_expected_version:original.version,p_request_id:randomUUID(),p_steps:input})));
  ensure(saves.filter(r=>!r.error).length===1 && saves.some(r=>r.error?.message==='VERSION_CONFLICT'),'Párhuzamos mentés nem verzióvédett');
  ensure(!JSON.stringify(await snap()).includes('Egyedi átvezetés'),'Jövőbeli szöveg kiszivárgott');
  let changed=0; await watch(one,game,()=>changed++);
  data(await host.rpc('start_round',{p_game_id:game,p_expected_version:(await plan()).version,p_request_id:randomUUID()}),'Indítás');
  await until(()=>changed>0,'Indítás Realtime');
  const round=(await snap()).round.id;
  data(await one.rpc('submit_rating',{p_round_id:round,p_price_bucket:5,p_alcohol_tenths:130,p_liking:8}),'Tipp');
  const current=await plan();
  data(await host.rpc('save_tasting_schedule',{p_game_id:game,p_expected_version:current.version,p_request_id:randomUUID(),p_steps:[current.steps[2],current.steps[1]]}),'Élő átrendezés');
  ensure((await snap()).own_rating.price_bucket===5,'Élő szerkesztés elvesztette a tippet');
  const beforeDisable=changed; await act('time',0); await until(()=>changed>beforeDisable,'Időkorlát kikapcsolás Realtime');
  const untimed=await snap(); ensure(untimed.round.closes_at===null && untimed.round.can_submit,'Időkorlát nélküli snapshot hibás');
  data(await one.rpc('submit_rating',{p_round_id:round,p_price_bucket:5,p_alcohol_tenths:130,p_liking:8}),'Időkorlát nélküli tipp');
  const before=changed; await act('time',300); await until(()=>changed>before,'Időváltozás Realtime');
  const timed=await snap(); ensure(Date.parse(timed.round.closes_at)-Date.parse(timed.server_now)>295000,'Új idő nem jutott el a játékoshoz');
  const running=await plan(); const version=running.version;
  const race=await Promise.all([host.rpc('control_tasting',{p_game_id:game,p_expected_version:version,p_request_id:randomUUID(),p_action:'close'}),
    peer.rpc('save_tasting_schedule',{p_game_id:game,p_expected_version:version,p_request_id:randomUUID(),p_steps:running.steps.filter(s=>s.status==='pending')})]);
  ensure(race.filter(r=>!r.error).length===1 && race.some(r=>r.error?.message==='VERSION_CONFLICT'),'Lezárás és mentés versengése hibás');
  if((await snap()).round.status==='open') await act('close');
  await act('next'); await act('close'); await act('reveal'); await act('next');
  ensure((await snap()).break.message==='Egyedi átvezetés','Átvezetés nem érkezett meg');
  ensure((await outsider.rpc('get_tasting_schedule',{p_game_id:game})).error,'Vendég kezelheti a menetet');
  await act('finish'); ensure((await snap()).game.status==='finished','Nem zárult le');
  process.stdout.write('Helyi Supabase: mentési és lezárási versengés, élő átrendezés, válaszmegőrzés, időváltozás Realtime, egyedi szünet és befejezés sikeres.\n');

} finally {
  for (const client of clients) { await client.removeAllChannels(); client.auth.stopAutoRefresh(); }
  for (const id of ids) data(await admin.auth.admin.deleteUser(id), 'Tesztadat-takarítás');
  admin.auth.stopAutoRefresh(); process.stdout.write('A saját szintetikus tesztfelhasználók és játékadatok törölve.\n');
}
