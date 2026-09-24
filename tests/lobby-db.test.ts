import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadDatabase } from '../scripts/database-harness.mjs';

const db = new PGlite();
const host = '00000000-0000-0000-0000-000000000001';
const guest = '00000000-0000-0000-0000-000000000002';
const other = '00000000-0000-0000-0000-000000000003';
const second = '00000000-0000-0000-0000-000000000004';
let game: string, token: string, participant: string;
interface Snapshot { game: { id: string; status: string; version: number }; role: string; self_participant_id: string | null;
  server_now: string; participants: { id: string; nickname: string; joined_at: string; seat: number }[] }
async function asUser(id: string, role = 'authenticated', aal = 'aal2') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.query("select set_config('request.jwt.claim.aal', $1, false)", [aal]);
  await db.exec(`set role ${role}`);
}
async function snapshot(id = game) { return (await db.query<{ data: Snapshot }>(
  'select public.get_lobby_snapshot($1) as data', [id])).rows[0].data; }
beforeAll(async () => { await loadDatabase(db); });
beforeEach(async () => {
  await db.exec(`reset role; truncate auth.users cascade;
    insert into auth.users(id,is_anonymous) values ('${host}',false),('${guest}',true),('${other}',false),('${second}',true); update auth.users set raw_app_meta_data = '{"vakkostolo_role":"superadmin"}' where not is_anonymous;`);
  await asUser(host);
  game = (await db.query<{ id: string }>(`select public.create_game(gen_random_uuid(),'Közös kóstoló',120,2,
    '[{"name":"Rejtett bor","price_huf":9876,"alcohol_tenths":142}]') as id`)).rows[0].id;
  token = (await db.query<{ data: { token: string } }>('select public.issue_invite($1) as data', [game])).rows[0].data.token;
  await asUser(guest);
  participant = (await db.query<{ data: { participant_id: string } }>('select public.join_game($1,$2) as data', [token, 'Anna'])).rows[0].data.participant_id;
});
afterAll(async () => { await db.close(); });
it('host és anonim tag ugyanazt a biztonságos listát látja; saját tagság külön azonosított', async () => {
  const player = await snapshot();
  expect(player.role).toBe('player');
  expect(player.self_participant_id).toBe(participant);
  expect(Object.keys(player).sort()).toEqual(['game', 'participants', 'role', 'self_participant_id', 'server_now']);
  expect(Object.keys(player.game).sort()).toEqual(['id', 'status', 'title', 'version']);
  expect(Object.keys(player.participants[0]).sort()).toEqual(['id', 'joined_at', 'nickname', 'seat']);
  expect(Number.isFinite(Date.parse(player.server_now))).toBe(true);
  await asUser(host);
  const owner = await snapshot();
  expect(owner.role).toBe('host'); expect(owner.self_participant_id).toBeNull();
  expect(owner.participants).toEqual(player.participants);
  expect(JSON.stringify(owner)).not.toMatch(/Rejtett bor|9876|alcohol|price|host_id|user_id|token|ratings/);
});
it('azonos becenevek sorszámmal megkülönböztethetők, a második belépés megjelenik', async () => {
  await asUser(second);
  await db.query('select public.join_game($1,$2)', [token, 'Anna']);
  await asUser(guest);
  const data = await snapshot();
  expect(data.participants.map((p) => p.seat)).toEqual([1, 2]);
  expect(data.participants.map((p) => p.nickname)).toEqual(['Anna', 'Anna']);
  expect(new Set(data.participants.map((p) => p.id)).size).toBe(2);
});
it('meghívócsere és lejárat után a meglévő tag továbbra is visszatérhet a játék URL-jén', async () => {
  await asUser(host); await db.query('select public.issue_invite($1)', [game]);
  await db.exec('reset role');
  await db.query("update public.game_invites set created_at = now()-interval '2 days', expires_at=now()-interval '1 day' where game_id=$1", [game]);
  await asUser(guest);
  expect((await snapshot()).self_participant_id).toBe(participant);
  await expect(db.query('select public.join_game($1)', [token])).rejects.toThrow('INVITE_INVALID');
});
it('idegen tartós és anonim felhasználó nem kérhet snapshotot', async () => {
  for (const id of [other, second]) { await asUser(id); await expect(snapshot()).rejects.toThrow('GAME_NOT_FOUND'); }
  await asUser(host);
  await expect(snapshot('10000000-0000-0000-0000-000000000099')).rejects.toThrow('GAME_NOT_FOUND');
});
it('signed-out anon szerep és hiányzó UID tiltott', async () => {
  await asUser('', 'anon'); await expect(snapshot()).rejects.toThrow(/permission denied/);
  await asUser(''); await expect(snapshot()).rejects.toThrow('AUTH_REQUIRED');
});
it('tagság megszűnése a következő snapshotot is tiltja', async () => {
  await db.exec('reset role'); await db.query('delete from public.participants where id=$1', [participant]);
  await asUser(guest); await expect(snapshot()).rejects.toThrow('GAME_NOT_FOUND');
});
it('játékállapot/version frissül, tippek és boradatok később sem kerülnek a váróba', async () => {
  await db.exec('reset role');
  await db.query("update public.games set status='tasting',version=version+1 where id=$1", [game]);
  await db.query(`insert into public.ratings(game_id,round_id,participant_id,price_huf,alcohol_tenths,liking)
    select $1,id,$2,12345,112,8 from public.rounds where game_id=$1`, [game, participant]);
  await asUser(guest);
  const data = await snapshot();
  expect(data.game.status).toBe('tasting'); expect(data.game.version).toBe(2);
  expect(JSON.stringify(data)).not.toMatch(/12345|liking|Rejtett bor|wine/);
});
it('Realtime publication csak játékot és résztvevőket publikál, RLS továbbra is él', async () => {
  await db.exec('reset role');
  const { rows } = await db.query<{ tablename: string }>("select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename");
  expect(rows.map((r) => r.tablename)).toEqual(['games', 'participants', 'rounds']);
  await asUser(other);
  expect((await db.query('select * from public.participants')).rows).toEqual([]);
  expect((await db.query('select * from public.games')).rows).toEqual([]);
  await asUser(guest);
  expect((await db.query('select * from public.wine_secrets')).rows).toEqual([]);
  await expect(db.query("update public.games set status='finished'")).rejects.toThrow(/permission denied/);
});
