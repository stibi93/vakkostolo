import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadDatabase } from '../scripts/database-harness.mjs';

const db = new PGlite();
const host = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const guest = '00000000-0000-0000-0000-000000000003';
const request = '10000000-0000-0000-0000-000000000001';
const wines = [{ name: '  Mintabor 2024  ', price_huf: 4500, alcohol_tenths: 125 },
  { name: 'Második mintabor', price_huf: 5900, alcohol_tenths: 140 }];
async function asUser(id: string, role = 'authenticated', aal = 'aal2') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.query("select set_config('request.jwt.claim.aal', $1, false)", [aal]);
  await db.exec(`set role ${role}`);
}
async function create(overrides: { id?: string | null; title?: string | null; seconds?: number | null;
  reveal?: number | null; wines?: unknown } = {}) {
  const values = { id: request, title: ' Kóstoló ', seconds: 120, reveal: 2, wines, ...overrides };
  const result = await db.query<{ id: string }>('select public.create_game($1,$2,$3,$4,$5::jsonb) as id',
    [values.id, values.title, values.seconds, values.reveal, JSON.stringify(values.wines)]);
  return result.rows[0].id;
}
beforeAll(async () => { await loadDatabase(db); });
beforeEach(async () => {
  await db.exec(`reset role; truncate auth.users cascade;
    insert into auth.users (id,is_anonymous) values ('${host}',false),('${other}',false),('${guest}',true); update auth.users set raw_app_meta_data = '{"vakkostolo_role":"superadmin"}' where not is_anonymous;`);
  await asUser(host);
});
afterAll(async () => { await db.close(); });

describe('create_game: szerveroldali létrehozás', () => {
  it('hostból draft játékot, rendezett köröket és titkos borokat hoz létre', async () => {
    const id = await create();
    expect((await db.query('select host_id,title,status,version,round_seconds,reveal_every from public.games')).rows)
      .toEqual([{ host_id: host, title: 'Kóstoló', status: 'draft', version: 0, round_seconds: 120, reveal_every: 2 }]);
    expect((await db.query('select position,status,closes_at from public.rounds order by position')).rows)
      .toEqual([{ position: 1, status: 'pending', closes_at: null }, { position: 2, status: 'pending', closes_at: null }]);
    const snapshot = (await db.query<{ data: { id: string; wines: unknown[] } }>('select public.get_host_game($1) as data', [id])).rows[0].data;
    expect(snapshot.id).toBe(id);
    expect(snapshot.wines).toEqual(wines.map((wine, i) => ({ ...wine, name: wine.name.trim(), position: i+1 })));
    expect((await db.query('select event_type,request_id from public.game_events')).rows)
      .toEqual([{ event_type: 'game_created', request_id: request }]);
    expect((await db.query('select * from public.game_invites')).rows).toEqual([]);
    expect((await db.query('select * from public.revealed_wines')).rows).toEqual([]);
  });
  it('ismételt kérés ugyanazt a játékot adja, új audit és kör nélkül', async () => {
    const id = await create();
    expect(await create({ title: 'Kóstoló' })).toBe(id);
    expect((await db.query('select * from public.games')).rows).toHaveLength(1);
    expect((await db.query('select * from public.rounds')).rows).toHaveLength(2);
    expect((await db.query('select * from public.game_events')).rows).toHaveLength(1);
    await expect(create({ title: 'Eltérő kérés' })).rejects.toThrow('REQUEST_ID_CONFLICT');
  });
  it('azonos request ID két hostnál két külön játékot jelent', async () => {
    const first = await create();
    await asUser(other);
    expect(await create()).not.toBe(first);
    expect((await db.query('select * from public.games')).rows).toHaveLength(1);
  });
  it('anonim, hiányzó és nem létező azonosító nem lehet host', async () => {
    await asUser(guest);
    await expect(create()).rejects.toThrow('PERMANENT_AUTH_REQUIRED');
    await asUser('');
    await expect(create()).rejects.toThrow('AUTH_REQUIRED');
    await asUser('00000000-0000-0000-0000-000000000099');
    await expect(create()).rejects.toThrow('PERMANENT_AUTH_REQUIRED');
  });
  it('a tartós Auth ellenőrzése az idempotens újrapróbáláskor is lefut', async () => {
    await create();
    await db.exec(`reset role; update auth.users set is_anonymous=true where id='${host}'`);
    await asUser(host);
    await expect(create()).rejects.toThrow('PERMANENT_AUTH_REQUIRED');
  });
  it.each([
    { id: null }, { title: null }, { title: ' ' }, { title: 'a'.repeat(101) },
    { seconds: null }, { seconds: 29 }, { seconds: 1801 }, { reveal: 0 }, { reveal: 13 },
    { wines: null }, { wines: {} }, { wines: [] }, { wines: Array.from({ length: 13 }, () => wines[0]) },
    { wines: [null] }, { wines: [{ ...wines[0], name: 123 }] },
    { wines: [{ ...wines[0], name: '  ' }] }, { wines: [{ ...wines[0], name: 'a'.repeat(201) }] },
    { wines: [{ ...wines[0], price_huf: '5000' }] }, { wines: [{ ...wines[0], price_huf: 0 }] },
    { wines: [{ ...wines[0], price_huf: 1000001 }] }, { wines: [{ ...wines[0], price_huf: 1.5 }] },
    { wines: [{ ...wines[0], alcohol_tenths: null }] }, { wines: [{ ...wines[0], alcohol_tenths: 251 }] },
    { wines: [{ ...wines[0], alcohol_tenths: 12.5 }] }, { wines: [{ ...wines[0], host_id: other }] },
  ])('hibás adatot atomikusan elutasít (%#)', async (invalid) => {
    await expect(create(invalid)).rejects.toThrow(/INVALID_/);
    expect((await db.query('select * from public.games')).rows).toHaveLength(0);
    expect((await db.query('select * from public.rounds')).rows).toHaveLength(0);
    expect((await db.query('select * from public.wine_secrets')).rows).toHaveLength(0);
    expect((await db.query('select * from public.game_events')).rows).toHaveLength(0);
  });
  it('hibás későbbi bor esetén nem marad fél játék, javítva ugyanazzal a request ID-val menthető', async () => {
    await expect(create({ wines: [wines[0], { ...wines[1], alcohol_tenths: -1 }] })).rejects.toThrow('INVALID_WINE');
    expect((await db.query('select * from public.games')).rows).toHaveLength(0);
    await expect(create()).resolves.toMatch(/^[a-f0-9-]{36}$/);
  });
});

describe('host olvasási határok', () => {
  it('másik host és a játék tagja sem olvashatja a host DTO-t', async () => {
    const id = await create();
    await db.exec('reset role');
    await db.query('insert into public.participants(game_id,user_id,nickname) values($1,$2,$3)', [id, other, 'Tag']);
    await asUser(other);
    await expect(db.query('select public.get_host_game($1)', [id])).rejects.toThrow('GAME_NOT_FOUND');
    expect((await db.query('select public.list_host_games() as data')).rows).toEqual([{ data: [] }]);
    expect((await db.query('select * from public.wine_secrets')).rows).toHaveLength(0);
    const visible = (await db.query('select * from public.rounds')).rows;
    expect(visible).toHaveLength(2);
    expect(JSON.stringify(visible)).not.toContain('Mintabor');
  });
  it('anonim fiók nem hívhat host listát/részleteket; signed-out szerep egyik RPC-t sem', async () => {
    const id = await create();
    await asUser(guest);
    await expect(db.query('select public.list_host_games()')).rejects.toThrow('PERMANENT_AUTH_REQUIRED');
    await expect(db.query('select public.get_host_game($1)', [id])).rejects.toThrow('PERMANENT_AUTH_REQUIRED');
    await asUser('', 'anon');
    await expect(create()).rejects.toThrow(/permission denied/);
    await expect(db.query('select public.list_host_games()')).rejects.toThrow(/permission denied/);
    await expect(db.query('select public.get_host_game($1)', [id])).rejects.toThrow(/permission denied/);
  });
  it('közvetlen írás és idempotenciaadat-olvasás a hostnak is tiltott', async () => {
    await create();
    await expect(db.query("insert into public.games(host_id,title) values($1,'Kerülőút')", [host])).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from private.game_creation_requests')).rejects.toThrow(/permission denied/);
    await expect(db.query('select private.require_permanent_user()')).rejects.toThrow(/permission denied/);
  });
});
