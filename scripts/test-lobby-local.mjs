// Opt-in integration: requires a running LOCAL Supabase CLI stack. Creates only
// temporary synthetic users/games and deletes those users (cascade) in finally.
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { setTimeout, clearTimeout } from 'node:timers';
import { createClient } from '@supabase/supabase-js';

let config;
try { config = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
catch { throw new Error('A helyi Supabase státusza nem olvasható. Indítsd el a helyi stacket.'); }
const url = config.API_URL;
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Csak helyi Supabase tesztelhető.');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, config.SERVICE_ROLE_KEY, options);
const clients = Array.from({ length: 4 }, () => createClient(url, config.ANON_KEY, options));
const ids = [];
function ensure(condition, message) { if (!condition) throw new Error(message); }
function data(result, label) { ensure(!result.error, `${label}: sikertelen kérés (${result.error?.code ?? 'ismeretlen'})`); return result.data; }
async function until(predicate, label) {
  const end = Date.now() + 12_000;
  while (!predicate()) { if (Date.now() > end) throw new Error(`${label}: időtúllépés`); await delay(100); }
}
async function watch(client, gameId, count) {
  const channel = client.channel(`local-check:${randomUUID()}`, { config: { postgres_changes_options: { wait: true } } })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter: `game_id=eq.${gameId}` }, count);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Realtime csatlakozási időtúllépés')), 12_000);
    channel.subscribe((status) => { if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); } });
  });
  return channel;
}
try {
  const [host, one, two, outsider] = clients;
  const email = `lobby-${randomUUID()}@example.test`, password = randomUUID();
  const hostUser = data(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'Teszt-host').user;
  ids.push(hostUser.id);
  data(await host.auth.signInWithPassword({ email, password }), 'Host Auth');
  for (const client of [one, two, outsider]) ids.push(data(await client.auth.signInAnonymously(), 'Anonim Auth').user.id);
  const game = data(await host.rpc('create_game', { p_request_id: randomUUID(), p_title: 'Automatikus helyi várópróba',
    p_round_seconds: 120, p_reveal_every: 2, p_wines: [{ name: 'Rejtett tesztbor', price_huf: 5432, alcohol_tenths: 131 }] }), 'Játék');
  const invite = data(await host.rpc('issue_invite', { p_game_id: game }), 'Meghívó');
  data(await one.rpc('join_game', { p_token: invite.token, p_nickname: 'Próba' }), 'Első vendég');
  let received = 0, leaked = 0;
  let channel = await watch(one, game, () => received++);
  await watch(outsider, game, () => leaked++);
  data(await two.rpc('join_game', { p_token: invite.token, p_nickname: 'Próba' }), 'Második vendég');
  await until(() => received > 0, 'Valódi Realtime INSERT');
  for (const client of [host, one, two]) {
    const snapshot = data(await client.rpc('get_lobby_snapshot', { p_game_id: game }), 'Snapshot');
    ensure(snapshot.participants.length === 2, 'Közös lista eltér');
    ensure(snapshot.participants[0].seat === 1 && snapshot.participants[1].seat === 2, 'Azonos nevek jelölése hibás');
    ensure(!JSON.stringify(snapshot).match(/Rejtett tesztbor|5432|price_huf|user_id|host_id/), 'Tiltott mező a snapshotban');
  }
  ensure((await outsider.rpc('get_lobby_snapshot', { p_game_id: game })).error?.message === 'GAME_NOT_FOUND', 'Idegen snapshot nem tiltott');
  ensure(data(await one.from('wine_secrets').select('*'), 'RLS boradat').length === 0, 'Titkos boradat szivárgás');
  await delay(300); ensure(leaked === 0, 'Idegen játék Realtime eseménye kiszivárgott');
  data(await host.rpc('issue_invite', { p_game_id: game }), 'Meghívócsere');
  ensure(data(await one.rpc('get_lobby_snapshot', { p_game_id: game }), 'Token nélküli visszatérés').participants.length === 2,
    'Meghívócsere elvesztette a tagságot');
  await one.removeChannel(channel);
  channel = await watch(one, game, () => received++);
  const renewed = data(await host.rpc('issue_invite', { p_game_id: game }), 'Új meghívó');
  const before = received;
  data(await outsider.rpc('join_game', { p_token: renewed.token, p_nickname: 'Új próba' }), 'Harmadik vendég');
  await until(() => received > before, 'Realtime újracsatlakozás');
  ensure(data(await one.rpc('get_lobby_snapshot', { p_game_id: game }), 'Friss lista').participants.length === 3, 'Újraolvasás hibás');
  await one.removeChannel(channel);
  process.stdout.write('Helyi Supabase: Auth, snapshot, RLS, két vendég, meghívócsere és Realtime újracsatlakozás sikeres.\n');
} finally {
  for (const client of clients) { await client.removeAllChannels(); client.auth.stopAutoRefresh(); }
  for (const id of ids) data(await admin.auth.admin.deleteUser(id), 'Tesztadat-takarítás');
  admin.auth.stopAutoRefresh();
  process.stdout.write('Saját szintetikus tesztfelhasználók és kapcsolódó játékadatok törölve.\n');
}
