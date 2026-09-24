import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadDatabase } from '../scripts/database-harness.mjs';

const db = new PGlite();
const host = '00000000-0000-0000-0000-000000000001';
const otherHost = '00000000-0000-0000-0000-000000000002';
const guest = '00000000-0000-0000-0000-000000000003';
const outsider = '00000000-0000-0000-0000-000000000004';
let game: string, round: string, round2: string, otherRound: string;
const photo = (gameId = game, roundId = round, ext = 'jpg') => `${gameId}/${roundId}.${ext}`;

async function asUser(id: string, role = 'authenticated', aal = 'aal2') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.query("select set_config('request.jwt.claim.aal', $1, false)", [aal]);
  await db.exec(`set role ${role}`);
}
async function canInsert(name: string, bucket = 'wine-photos') {
  try { await db.query('insert into storage.objects(bucket_id, name) values ($1, $2)', [bucket, name]); return true; }
  catch (error) { if (String(error).includes('row-level security')) return false; throw error; }
}
const visible = async (name: string) => (await db.query('select 1 from storage.objects where name = $1', [name])).rows.length === 1;
const updated = async (name: string) => (await db.query("update storage.objects set metadata = '{}' where name = $1", [name])).affectedRows === 1;
const deleted = async (name: string) => (await db.query('delete from storage.objects where name = $1', [name])).affectedRows === 1;
async function reveal(id: string) {
  await db.exec('reset role');
  await db.query("update public.rounds set status = 'revealed', opened_at = now() - interval '5 minutes', closes_at = now() - interval '3 minutes' where id = $1", [id]);
}
async function seed(name: string) {
  await db.exec('reset role');
  await db.query("insert into storage.objects(bucket_id, name) values ('wine-photos', $1)", [name]);
}
async function hostGame(id: string) {
  return (await db.query<{ data: { wines: Record<string, unknown>[] } }>('select public.get_host_game($1) as data', [id])).rows[0].data;
}

beforeAll(async () => { await loadDatabase(db); });
beforeEach(async () => {
  await db.exec(`reset role; delete from storage.objects; truncate auth.users cascade;
    insert into auth.users(id, is_anonymous) values ('${host}', false), ('${otherHost}', false), ('${guest}', true), ('${outsider}', true);
    update auth.users set raw_app_meta_data = '{"vakkostolo_role":"superadmin"}' where not is_anonymous;`);
  const create = `select public.create_game(gen_random_uuid(), $1, 120, 2,
    '[{"name":"Rejtett bor","price_huf":9876,"alcohol_tenths":142},{"name":"Második","price_huf":4000,"alcohol_tenths":120}]') as id`;
  await asUser(otherHost);
  const foreign = (await db.query<{ id: string }>(create, ['Idegen kóstoló'])).rows[0].id;
  await asUser(host);
  game = (await db.query<{ id: string }>(create, ['Fotós kóstoló'])).rows[0].id;
  const rounds = (await db.query<{ id: string }>('select id from public.rounds where game_id = $1 order by position', [game])).rows;
  round = rounds[0].id; round2 = rounds[1].id;
  await db.exec('reset role');
  otherRound = (await db.query<{ id: string }>('select id from public.rounds where game_id = $1 limit 1', [foreign])).rows[0].id;
  await asUser(host);
  const token = (await db.query<{ data: { token: string } }>('select public.issue_invite($1) as data', [game])).rows[0].data.token;
  await asUser(guest);
  await db.query('select public.join_game($1, $2)', [token, 'Anna']);
});
afterAll(async () => { await db.close(); });

describe('borfotó: privát bucket és játékmesteri kezelés', () => {
  it('a bucket privát, csak JPEG, legfeljebb 2 MB', async () => {
    await db.exec('reset role');
    expect((await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'wine-photos'")).rows)
      .toEqual([{ public: false, file_size_limit: 2097152, allowed_mime_types: ['image/jpeg'] }]);
  });
  it('a játékmester feltölthet, cserélhet, láthat és törölhet a felfedés előtt', async () => {
    await asUser(host);
    expect(await canInsert(photo())).toBe(true);
    expect(await visible(photo())).toBe(true);
    expect(await updated(photo())).toBe(true);
    expect(await deleted(photo())).toBe(true);
  });
  it('második faktor nélkül a játékmester sem kezelheti és nem is láthatja', async () => {
    await seed(photo());
    await asUser(host, 'authenticated', 'aal1');
    expect(await canInsert(photo(game, round2))).toBe(false);
    expect(await visible(photo())).toBe(false);
    expect(await deleted(photo())).toBe(false);
  });
  it('másik játékmester és kívülálló nem fér hozzá', async () => {
    await seed(photo());
    for (const user of [otherHost, outsider]) {
      await asUser(user);
      expect(await visible(photo())).toBe(false);
      expect(await updated(photo())).toBe(false);
      expect(await deleted(photo())).toBe(false);
    }
    await asUser(otherHost);
    expect(await canInsert(photo(game, round2))).toBe(false);
  });
  it('csak a pontos `<játék>/<kör>.jpg` útvonal és a saját kör fogadható el', async () => {
    await asUser(host);
    for (const bad of [photo(game, round, 'png'), photo(game, otherRound), `${game}/${round}`, `x/${photo()}`,
      `${photo()}/x.jpg`, photo(game.toUpperCase())]) expect(await canInsert(bad)).toBe(false);
    await db.exec("reset role; insert into storage.buckets(id, name) values ('other', 'other') on conflict do nothing");
    await asUser(host);
    expect(await canInsert(photo(), 'other')).toBe(false);
  });
});

describe('borfotó: felfedéshez kötött játékosi hozzáférés', () => {
  it('a tag a felfedés előtt nem látja, utána igen; írni soha nem tud', async () => {
    await seed(photo());
    await asUser(guest);
    expect(await visible(photo())).toBe(false);
    expect(await canInsert(photo(game, round2))).toBe(false);
    await reveal(round);
    await asUser(guest);
    expect(await visible(photo())).toBe(true);
    expect(await updated(photo())).toBe(false);
    expect(await deleted(photo())).toBe(false);
  });
  it('felfedés után a játékmester látja, de már nem cserélheti vagy törölheti', async () => {
    await seed(photo());
    await reveal(round);
    await asUser(host);
    expect(await visible(photo())).toBe(true);
    expect(await updated(photo())).toBe(false);
    expect(await deleted(photo())).toBe(false);
    await db.exec('reset role; delete from storage.objects');
    await asUser(host);
    expect(await canInsert(photo())).toBe(false);
  });
  it('kijelentkezett látogató (anon szerep) és a belső segédfüggvények tiltottak', async () => {
    await asUser('', 'anon');
    await expect(db.query('select 1 from storage.objects')).rejects.toThrow(/permission denied/);
    await asUser(host);
    await expect(db.query('select private.is_host_session()')).rejects.toThrow(/permission denied/);
    await expect(db.query("select private.wine_photo_round('wine-photos', 'x')")).rejects.toThrow(/permission denied/);
  });
});

describe('get_host_game: fotóállapot a játékmesternek', () => {
  it('körazonosítót, fotóidőpontot és zárolást ad vissza', async () => {
    await asUser(host);
    let wines = (await hostGame(game)).wines;
    expect(wines.map((wine) => [wine.round_id, wine.photo_updated_at, wine.photo_locked])).toEqual([
      [round, null, false], [round2, null, false]]);
    await seed(photo());
    await reveal(round);
    await asUser(host);
    wines = (await hostGame(game)).wines;
    expect(typeof wines[0].photo_updated_at).toBe('string');
    expect(wines[0].photo_locked).toBe(true);
    expect(wines[1].photo_updated_at).toBeNull();
  });
});
