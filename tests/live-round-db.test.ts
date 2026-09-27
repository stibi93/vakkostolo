import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadDatabase } from '../scripts/database-harness.mjs';

const db = new PGlite();
const host = '00000000-0000-0000-0000-000000000001';
const guest = '00000000-0000-0000-0000-000000000002';
const other = '00000000-0000-0000-0000-000000000003';
const late = '00000000-0000-0000-0000-000000000004';
const request = '10000000-0000-0000-0000-000000000001';
let game: string, token: string, round: string;
interface Snapshot { game: { status: string; version: number }; server_now: string; role: string;
  round: null | { id: string; position: number; status: string; opened_at: string; closes_at: string; eligible: boolean; can_submit: boolean };
  own_rating: null | { round_id: string; price_bucket: number; alcohol_tenths: number; liking: number; submitted_at: string } }
async function asUser(id: string, role = 'authenticated', aal = 'aal2') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.query("select set_config('request.jwt.claim.aal', $1, false)", [aal]);
  await db.exec(`set role ${role}`);
}
async function snapshot(id = game) { return (await db.query<{ data: Snapshot }>(
  'select public.get_game_snapshot($1) as data', [id])).rows[0].data; }
async function start(version = 1, key = request) { return (await db.query<{ id: string }>(
  'select public.start_round($1,$2,$3) as id', [game, version, key])).rows[0].id; }
beforeAll(async () => { await loadDatabase(db); });
beforeEach(async () => {
  await db.exec(`reset role; truncate auth.users cascade;
    insert into auth.users(id,is_anonymous) values ('${host}',false),('${guest}',true),('${other}',false),('${late}',true); update auth.users set raw_app_meta_data = '{"vakkostolo_role":"superadmin"}' where not is_anonymous;`);
  await asUser(host);
  game = (await db.query<{ id: string }>(`select public.create_game(gen_random_uuid(),'Élő próba',120,2,
    '[{"name":"Titkos pincészet","price_huf":9876,"alcohol_tenths":142},
      {"name":"Másik titkos bor","price_huf":12345,"alcohol_tenths":128}]') as id`)).rows[0].id;
  token = (await db.query<{ data: { token: string } }>('select public.issue_invite($1) as data', [game])).rows[0].data.token;
  await asUser(guest); await db.query('select public.join_game($1,$2)', [token, 'Anna']);
  await asUser(other); await db.query('select public.join_game($1,$2)', [token, 'Béla']);
  await asUser(host);
  round = (await db.query<{ id: string }>('select id from public.rounds where game_id=$1 order by position', [game])).rows[0].id;
});
afterAll(async () => { await db.close(); });
it('váróban még nincs aktív kör vagy saját válasz', async () => {
  expect(await snapshot()).toMatchObject({ round: null, own_rating: null, game: { status: 'lobby', version: 1 } });
});
it('indítás az első kört nyitja szerveridővel; nincs titkos adat vagy másik tipp', async () => {
  expect(await start()).toBe(round);
  const hostState = await snapshot();
  expect(hostState).toMatchObject({ game: { status: 'tasting', version: 2 }, round: { id: round, position: 1, status: 'open', eligible: false, can_submit: false }, own_rating: null });
  expect(Date.parse(hostState.round!.closes_at) - Date.parse(hostState.round!.opened_at)).toBe(120_000);
  await asUser(other); await db.query('select public.submit_rating($1,8,111,7)', [round]);
  await asUser(guest);
  const player = await snapshot();
  expect(player.round).toMatchObject({ eligible: true, can_submit: true });
  expect(player.own_rating).toBeNull();
  expect(JSON.stringify(player)).not.toMatch(/Titkos|9876|12345|123456|alcohol_tenths|price_huf|wine|score/);
  expect(Object.keys(player.round!).sort()).toEqual(['can_submit','closes_at','eligible','id','opened_at','position','questions','status']);
  await asUser(host); expect((await snapshot()).own_rating).toBeNull();
  expect((await db.query("select status from public.rounds where game_id=$1 order by position", [game])).rows).toEqual([{ status: 'open' }, { status: 'pending' }]);
});
it('azonos kérés megismétlése nem állítja vissza az időt vagy ír második eseményt', async () => {
  await start(); const first = await snapshot(); await start();
  expect((await snapshot()).round).toEqual(first.round);
  expect((await snapshot()).game.version).toBe(2);
  expect((await db.query("select event_type from public.game_events where game_id=$1 and event_type='round_started'", [game])).rows).toHaveLength(1);
  await expect(start(2)).rejects.toThrow('REQUEST_ID_CONFLICT');
});
it('másik hostlap elavult verzióval nem indít második kört', async () => {
  await start();
  await expect(start(1, '10000000-0000-0000-0000-000000000002')).rejects.toThrow('VERSION_CONFLICT');
  await expect(start(2, '10000000-0000-0000-0000-000000000002')).rejects.toThrow('GAME_NOT_IN_LOBBY');
  expect((await db.query("select id from public.rounds where game_id=$1 and status='open'", [game])).rows).toHaveLength(1);
});
it('csak a tartós saját host indíthat; signed-out és privát receipts tiltott', async () => {
  await asUser(guest); await expect(start()).rejects.toThrow('PERMANENT_AUTH_REQUIRED');
  await asUser(other); await expect(start()).rejects.toThrow('GAME_NOT_FOUND');
  await expect(db.query('select * from private.round_start_requests')).rejects.toThrow(/permission denied/);
  await asUser('', 'anon'); await expect(start()).rejects.toThrow(/permission denied/);
  await expect(snapshot()).rejects.toThrow(/permission denied/);
  await asUser(''); await expect(snapshot()).rejects.toThrow('AUTH_REQUIRED');
  await asUser(late); await expect(snapshot()).rejects.toThrow('GAME_NOT_FOUND');
});
it('érvénytelen indítás atomikus, hiányzó bor és nem váró állapot tiltott', async () => {
  await expect(db.query('select public.start_round($1,null,$2)', [game, request])).rejects.toThrow('INVALID_START_REQUEST');
  await db.exec('reset role'); await db.query('delete from public.wine_secrets where round_id=$1', [round]);
  await asUser(host); await expect(start()).rejects.toThrow('WINES_INCOMPLETE');
  expect((await snapshot()).game).toMatchObject({ version: 1, status: 'lobby' });
  expect((await snapshot()).round).toBeNull();
  await db.exec('reset role'); await db.query("update public.games set status='draft' where id=$1", [game]);
  await asUser(host); await expect(start()).rejects.toThrow('GAME_NOT_IN_LOBBY');
});
it('saját válasz újraolvasható és egyetlen soron módosítható; másik résztvevőé rejtett', async () => {
  await start(); await asUser(guest);
  await db.query('select public.submit_rating($1,5,135,8)', [round]);
  await db.query('select public.submit_rating($1,6,140,9)', [round]);
  expect((await snapshot()).own_rating).toMatchObject({ round_id: round, price_bucket: 6, alcohol_tenths: 140, liking: 9 });
  expect((await db.query('select * from public.ratings')).rows).toHaveLength(1);
  await asUser(other); expect((await snapshot()).own_rating).toBeNull();
  expect((await db.query('select * from public.ratings')).rows).toHaveLength(0);
});
it('későn belépő a nyitott körbe közvetlen RPC-vel sem küldhet', async () => {
  await start(); await asUser(late); await db.query('select public.join_game($1,$2)', [token, 'Késői']);
  expect((await snapshot()).round).toMatchObject({ eligible: false, can_submit: false });
  await expect(db.query('select public.submit_rating($1,5,135,8)', [round])).rejects.toThrow('ROUND_NOT_ELIGIBLE');
});
it('lejárt határidőnél open állapot és ismételt kérés mellett is tiltott a felülírás', async () => {
  await start(); await asUser(guest); await db.query('select public.submit_rating($1,5,135,8)', [round]);
  await db.exec('reset role');
  await db.query("update public.rounds set opened_at=clock_timestamp()-interval '2 minutes',closes_at=clock_timestamp()-interval '1 second' where id=$1", [round]);
  await asUser(guest); expect((await snapshot()).round?.can_submit).toBe(false);
  await expect(db.query('select public.submit_rating($1,6,140,9)', [round])).rejects.toThrow('DEADLINE_PASSED');
  expect((await snapshot()).own_rating?.price_bucket).toBe(5);
  await asUser(host); expect(await start()).toBe(round);
  expect((await snapshot()).round?.can_submit).toBe(false);
});
it('Realtime csak publikus köradatot adhat; ratings és titkos táblák nincsenek publikálva', async () => {
  const tables = (await db.query<{ tablename: string }>("select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename")).rows;
  expect(tables.map(r => r.tablename)).toEqual(['games', 'participants', 'rounds']);
  await start(); await asUser(late);
  expect((await db.query('select * from public.rounds')).rows).toHaveLength(0);
  await expect(db.query("update public.games set status='tasting' where id=$1", [game])).rejects.toThrow(/permission denied/);
});
it('árkategória: új játék 2-es pontozási verziót kap, a mentett tipp csak kategóriát tárol', async () => {
  await db.exec('reset role');
  expect((await db.query('select scoring_version from public.games where id=$1', [game])).rows).toEqual([{ scoring_version: 3 }]);
  await expect(db.query('update public.games set scoring_version=4 where id=$1', [game])).rejects.toThrow(/check constraint/);
  const buckets = await db.query<{ b: number }>(`select private.price_bucket(v) as b
    from unnest(array[0,1000,1001,2000,2001,4000,4001,6000,6001,8000,8001,10000,10001]) v`);
  expect(buckets.rows.map((row) => row.b)).toEqual([1, 1, 2, 2, 3, 4, 5, 5, 6, 6, 7, 7, 8]);
  await asUser(host); await start(); await asUser(guest);
  for (const bad of ['9,135,8', 'null,135,8', '5,null,8', '5,135,null', '5,135,11']) {
    await expect(db.query(`select public.submit_rating($1,${bad})`, [round])).rejects.toThrow('RATING_INVALID');
  }
  await db.query('select public.submit_rating($1,8,120,3)', [round]);
  const own = (await snapshot()).own_rating!;
  expect(Object.keys(own).sort()).toEqual(['alcohol_tenths', 'custom_answers', 'liking', 'price_bucket', 'round_id', 'submitted_at']);
  expect(own).toMatchObject({ price_bucket: 8, alcohol_tenths: 120, liking: 3 });
  await expect(db.query('select private.price_bucket(1000)')).rejects.toThrow(/permission denied/);
});
