// Real local Supabase Realtime presence check. Creates and removes its own synthetic users/game.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const url = status.API_URL, anonKey = status.PUBLISHABLE_KEY || status.ANON_KEY, secret = status.SECRET_KEY || status.SERVICE_ROLE_KEY;
if (!/^http:\/\/127\.0\.0\.1:/.test(url)) throw new Error('local only');
const admin = createClient(url, secret, { auth: { persistSession: false } });
const sql = (q) => execFileSync('docker', ['exec', 'supabase_db_vakkostolo', 'psql', '-U', 'postgres', '-Atc', q], { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok) => { results.push([name, ok]); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`); };
const created = [];
const newClient = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function anon() { const c = newClient(); const { data, error } = await c.auth.signInAnonymously(); if (error) throw error; created.push(data.user.id); return { c, id: data.user.id }; }
async function subscribe(c, gameId, onSync) {
  const channel = c.channel(`game:${gameId}:presence`, { config: { private: true } });
  channel.on('presence', { event: 'sync' }, () => onSync?.(channel.presenceState()));
  const state = await new Promise((resolve) => {
    const t = setTimeout(() => resolve('TIMEOUT'), 8000);
    channel.subscribe((s) => { if (s !== 'CLOSED') { clearTimeout(t); resolve(s); } });
  });
  return { channel, state };
}
const ids = (state) => new Set(Object.values(state).flat().map((m) => m.participant_id));

let game;
try {
  const email = `presence-host-${Date.now()}@superadmin.vakkostolo.invalid`, password = `Pr3sence-${crypto.randomUUID()}`;
  const { data: hostUser, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { vakkostolo_role: 'superadmin' } });
  if (error) throw error;
  created.push(hostUser.user.id);
  const host = newClient(); await host.auth.signInWithPassword({ email, password });
  const a = await anon(), b = await anon(), outsider = await anon();
  game = sql(`insert into public.games(host_id,title,status) values ('${hostUser.user.id}','Jelenléti próba','lobby') returning id`).split('\n')[0];
  const pa = sql(`insert into public.participants(game_id,user_id,nickname) values ('${game}','${a.id}','Anna') returning id`).split('\n')[0];
  const pb = sql(`insert into public.participants(game_id,user_id,nickname) values ('${game}','${b.id}','Béla') returning id`).split('\n')[0];

  let hostView = new Set();
  const h = await subscribe(host, game, (s) => { hostView = ids(s); });
  check('játékmester csatlakozik a privát jelenléti csatornához', h.state === 'SUBSCRIBED');
  const o = await subscribe(outsider.c, game);
  check('kívülálló anonim felhasználót a szerver elutasítja', o.state === 'CHANNEL_ERROR');
  const hostTrack = await h.channel.track({ participant_id: pa });
  await sleep(1500);
  check('játékmester nem jelezheti magát játékosként', hostTrack !== 'ok' || !hostView.has(pa));
  await h.channel.untrack().catch(() => {});

  const ca = await subscribe(a.c, game); const cb = await subscribe(b.c, game);
  check('két tag csatlakozik', ca.state === 'SUBSCRIBED' && cb.state === 'SUBSCRIBED');
  await ca.channel.track({ participant_id: pa }); await cb.channel.track({ participant_id: pb });
  await sleep(1500);
  check('játékmester élőben látja mindkét játékost', hostView.has(pa) && hostView.has(pb));

  await a.c.removeChannel(ca.channel);
  await sleep(1500);
  check('kilépés (csatorna elhagyása) azonnal eltűnik', !hostView.has(pa) && hostView.has(pb));

  b.c.realtime.disconnect();
  await sleep(2500);
  check('kapcsolat bontása után is eltűnik', !hostView.has(pb));

  const again = await subscribe(a.c, game); await again.channel.track({ participant_id: pa });
  await sleep(1500);
  check('visszatérő játékos újra megjelenik', hostView.has(pa));
  await a.c.removeChannel(again.channel);
  await host.removeChannel(h.channel);
} finally {
  if (game) sql(`delete from public.games where id='${game}'`);
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`takarítás: ${created.length} szintetikus felhasználó és a próbajáték törölve`);
  const failed = results.filter(([, ok]) => !ok).length;
  console.log(`${results.length - failed}/${results.length} sikeres`);
  process.exit(failed ? 1 : 0);
}
