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
  const game = data(await host.rpc('create_game', { p_request_id: randomUUID(), p_title: 'Automatikus élőkör-próba',
    p_round_seconds: 30, p_reveal_every: 2, p_wines: [{ name: 'Titkos próbabeli bor', price_huf: 9876, alcohol_tenths: 142 }] }), 'Játék');
  const invite = data(await host.rpc('issue_invite', { p_game_id: game }), 'Meghívó');
  for (const client of [one, two]) data(await client.rpc('join_game', { p_token: invite.token, p_nickname: 'Próba' }), 'Tagság');
  ensure((await outsider.rpc('get_game_snapshot', { p_game_id: game })).error?.message === 'GAME_NOT_FOUND', 'Idegen snapshot nem tiltott');
  let changed = 0, leaked = 0;
  await watch(one, game, () => changed++); await watch(outsider, game, () => leaked++);
  const requests = [randomUUID(), randomUUID()];
  const starts = await Promise.all([host, peer].map((client, index) => client.rpc('start_round', {
    p_game_id: game, p_expected_version: 1, p_request_id: requests[index],
  })));
  ensure(starts.filter(result => !result.error).length === 1, 'Két versengő indításból nem pontosan egy sikerült');
  ensure(starts.some(result => result.error?.message === 'VERSION_CONFLICT'), 'Második indítás nem verzióütközés');
  const winner = starts.findIndex(result => !result.error), round = starts[winner].data;
  await until(() => changed > 0, 'Kör Realtime'); await delay(300); ensure(leaked === 0, 'Idegen kör eseménye kiszivárgott');
  const first = data(await one.rpc('get_game_snapshot', { p_game_id: game }), 'Indított kör');
  ensure(first.round.can_submit && first.round.eligible, 'Korábban belépett játékos nem jogosult');
  ensure(!JSON.stringify(first).match(/Titkos próbabeli bor|9876|price_huf|alcohol_tenths|score/), 'Titok a játékos pillanatképében');
  ensure(data(await host.rpc('start_round', { p_game_id: game, p_expected_version: 1, p_request_id: requests[winner] }), 'Ismételt indítás') === round, 'Ismétlés másik kört ad');
  ensure(data(await one.rpc('get_game_snapshot', { p_game_id: game }), 'Változatlan határidő').round.closes_at === first.round.closes_at, 'Ismétlés újraindította az órát');
  data(await outsider.rpc('join_game', { p_token: invite.token, p_nickname: 'Késői' }), 'Késői belépés');
  ensure((await outsider.rpc('submit_rating', { p_round_id: round, p_price_bucket: 1, p_alcohol_tenths: 100, p_liking: 1 })).error?.message === 'ROUND_NOT_ELIGIBLE', 'Késői beküldés nem tiltott');
  const rate = bucket => ({ p_round_id: round, p_price_bucket: bucket, p_alcohol_tenths: 135, p_liking: 8 });
  for (const result of await Promise.all([one.rpc('submit_rating', rate(4)), one.rpc('submit_rating', rate(5))])) data(result, 'Párhuzamos tippek');
  data(await one.rpc('submit_rating', rate(6)), 'Végső módosítás');
  ensure(data(await one.from('ratings').select('*'), 'Saját válasz').length === 1, 'Válasz duplikálódott');
  ensure(data(await two.from('ratings').select('*'), 'Idegen válaszok').length === 0, 'Másik vendég tippje kiszivárgott');
  ensure(data(await host.rpc('get_game_snapshot', { p_game_id: game }), 'Host snapshot').own_rating === null, 'Host kapott rejtett választ');
  ensure(data(await one.rpc('get_game_snapshot', { p_game_id: game }), 'Visszatérés').own_rating.price_bucket === 6, 'Mentett válasz nem tért vissza');
  process.stdout.write('Valódi hostversengés, Realtime, késői belépés és saját tipp sikeres; várakozás a 30 másodperces szerverhatáridőre.\n');
  await delay(Math.max(0, Date.parse(first.round.closes_at) - Date.now() + 150));
  ensure((await one.rpc('submit_rating', rate(7))).error?.message === 'DEADLINE_PASSED', 'Lejárt módosítás nem tiltott');
  const expired = data(await one.rpc('get_game_snapshot', { p_game_id: game }), 'Lejárt snapshot');
  ensure(!expired.round.can_submit && expired.own_rating.price_bucket === 6, 'Lejárt válasz vagy mentett állapot hibás');
  process.stdout.write('Helyi Supabase élőkör-próba sikeres, lejárt beküldés elutasítva.\n');
} finally {
  for (const client of clients) { await client.removeAllChannels(); client.auth.stopAutoRefresh(); }
  for (const id of ids) data(await admin.auth.admin.deleteUser(id), 'Tesztadat-takarítás');
  admin.auth.stopAutoRefresh(); process.stdout.write('A saját szintetikus tesztfelhasználók és játékadatok törölve.\n');
}
