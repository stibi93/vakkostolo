import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadDatabase } from '../scripts/database-harness.mjs';

const db = new PGlite();
const host = '00000000-0000-0000-0000-000000000001';
const guest = '00000000-0000-0000-0000-000000000002';
const outsider = '00000000-0000-0000-0000-000000000003';
let game: string, otherGame: string;
const topic = (id: string) => `game:${id}:presence`;

async function asUser(id: string | null, channel: string, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  await db.query("select set_config('request.jwt.claim.aal', 'aal2', false)");
  await db.query("select set_config('realtime.topic', $1, false)", [channel]);
  await db.exec(`set role ${role}`);
}
/** Realtime authorizes a join by probing whether the user could read a message on the topic. */
async function canRead(user: string | null, channel: string, extension = 'presence') {
  await db.exec('reset role; delete from realtime.messages');
  await db.query('insert into realtime.messages(topic, extension) values ($1, $2)', [channel, extension]);
  await asUser(user, channel);
  return (await db.query('select 1 from realtime.messages')).rows.length === 1;
}
async function canTrack(user: string | null, channel: string, extension = 'presence') {
  await asUser(user, channel);
  try {
    await db.query('insert into realtime.messages(topic, extension) values (realtime.topic(), $1)', [extension]);
    return true;
  } catch { return false; }
}

beforeAll(async () => { await loadDatabase(db); });
beforeEach(async () => {
  await db.exec(`reset role; delete from realtime.messages; truncate auth.users cascade;
    insert into auth.users(id, is_anonymous) values ('${host}', false), ('${guest}', true), ('${outsider}', true);
    update auth.users set raw_app_meta_data = '{"vakkostolo_role":"superadmin"}' where not is_anonymous;`);
  await asUser(host, '');
  const create = `select public.create_game(gen_random_uuid(), $1, 120, 2,
    '[{"name":"Rejtett bor","price_huf":9876,"alcohol_tenths":142}]') as id`;
  game = (await db.query<{ id: string }>(create, ['Jelenléti kóstoló'])).rows[0].id;
  otherGame = (await db.query<{ id: string }>(create, ['Másik kóstoló'])).rows[0].id;
  const token = (await db.query<{ data: { token: string } }>('select public.issue_invite($1) as data', [game])).rows[0].data.token;
  await asUser(guest, '');
  await db.query('select public.join_game($1, $2)', [token, 'Anna']);
});
afterAll(async () => { await db.close(); });

it('a tag látja és jelezheti a jelenlétét a saját kóstolójában', async () => {
  expect(await canRead(guest, topic(game))).toBe(true);
  expect(await canTrack(guest, topic(game))).toBe(true);
});

it('a játékmester látja a jelenlétet, de játékosként nem jelezheti magát', async () => {
  expect(await canRead(host, topic(game))).toBe(true);
  expect(await canTrack(host, topic(game))).toBe(false);
});

it('kívülálló és idegen kóstoló tiltott', async () => {
  expect(await canRead(outsider, topic(game))).toBe(false);
  expect(await canTrack(outsider, topic(game))).toBe(false);
  expect(await canRead(guest, topic(otherGame))).toBe(false);
  expect(await canTrack(guest, topic(otherGame))).toBe(false);
});

it('csak a pontos csatornanév és csak presence engedélyezett', async () => {
  for (const bad of [`game:${game}`, `game:${game}:presence:x`, `lobby:${game}:1`, `GAME:${game}:presence`, `x game:${game}:presence`]) {
    expect(await canRead(guest, bad)).toBe(false);
    expect(await canTrack(guest, bad)).toBe(false);
  }
  expect(await canRead(guest, topic(game), 'broadcast')).toBe(false);
  expect(await canTrack(guest, topic(game), 'broadcast')).toBe(false);
});

it('kijelentkezett látogató (anon szerep) nem fér hozzá', async () => {
  await asUser(null, topic(game), 'anon');
  await expect(db.query('select 1 from realtime.messages')).rejects.toThrow(/permission denied/);
});
