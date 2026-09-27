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
    const roundIds = (await db.query<{ id: string }>('select id from public.rounds order by position')).rows.map((row) => row.id);
    expect(snapshot.id).toBe(id);
    expect(snapshot.wines).toEqual(wines.map((wine, i) => ({ ...wine, name: wine.name.trim(), position: i+1,
      round_id: roundIds[i], photo_updated_at: null, photo_locked: false })));
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
    { wines: null }, { wines: {} }, { wines: [] }, { wines: Array.from({ length: 41 }, () => wines[0]) },
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
  it('13 bor is menthető, 41 nem', async () => {
    const many = Array.from({ length: 13 }, (_, index) => ({ name: `Bor ${index + 1}`, price_huf: 4500, alcohol_tenths: 125 }));
    await create({ id: '10000000-0000-0000-0000-000000000013', wines: many });
    expect((await db.query<{ position: number }>('select position from public.rounds order by position')).rows.map(row => row.position))
      .toEqual(many.map((_, index) => index + 1));
    await expect(create({ id: '10000000-0000-0000-0000-000000000041', wines: Array.from({ length: 41 }, () => wines[0]) }))
      .rejects.toThrow('INVALID_WINES');
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

describe('kóstoló törlése', () => {
  it('csak saját aal2 host készítheti elő és törölheti; az ismétlés biztonságos', async () => {
    const id=await create();
    await asUser(other);await expect(db.query('select public.delete_game($1)',[id])).rejects.toThrow('GAME_NOT_FOUND');
    await asUser(guest);await expect(db.query('select public.delete_game($1)',[id])).rejects.toThrow('PERMANENT_AUTH_REQUIRED');
    await asUser(host,'authenticated','aal1');await expect(db.query('select public.delete_game($1)',[id])).rejects.toThrow(/MFA/);
    await asUser(host);
    await expect(db.query('select public.delete_game($1,true)',[id])).rejects.toThrow('DELETE_NOT_PREPARED');
    await db.query('select public.delete_game($1)',[id]);
    await db.query('select public.delete_game($1,true)',[id]);
    await db.query('select public.delete_game($1)',[id]);
    await db.query('select public.delete_game($1,true)',[id]);
    expect((await db.query('select * from public.games')).rows).toHaveLength(0);
    expect((await db.query('select * from public.rounds')).rows).toHaveLength(0);
    expect((await db.query('select * from public.wine_secrets')).rows).toHaveLength(0);
    await expect(db.query('select public.get_host_game($1)',[id])).rejects.toThrow('GAME_NOT_FOUND');
    await asUser(other);await expect(db.query('select public.delete_game($1,true)',[id])).rejects.toThrow('GAME_NOT_FOUND');
  });
  it('a felfedett fotó is törölhető előkészítés után, megmaradt objektumnál a játék nem törlődik',async()=>{
    const id=await create();
    const round=(await db.query<{id:string}>('select id from public.rounds where game_id=$1 limit 1',[id])).rows[0].id;
    const path=id+'/'+round+'.jpg';
    await db.query("insert into storage.objects(bucket_id,name) values('wine-photos',$1)",[path]);
    await db.exec('reset role');
    await db.query("update public.rounds set status='revealed',opened_at=now(),closes_at=now()+interval '120 seconds' where id=$1",[round]);
    await asUser(host);
    expect((await db.query('delete from storage.objects where name=$1',[path])).affectedRows).toBe(0);
    const prepared=await db.query<{paths:string[]}>('select public.delete_game($1) paths',[id]);
    expect(prepared.rows[0].paths).toEqual([path]);
    await expect(db.query('select public.delete_game($1,true)',[id])).rejects.toThrow('PHOTOS_REMAIN');
    await asUser(other);expect((await db.query('delete from storage.objects where name=$1',[path])).affectedRows).toBe(0);
    await asUser(host);expect((await db.query('delete from storage.objects where name=$1',[path])).affectedRows).toBe(1);
    await db.query('select public.delete_game($1,true)',[id]);
  });
});

describe('teljes menet létrehozása',()=>{
  const agenda=[{kind:'wine',wine_index:0},{kind:'break',title:'Pihenő',message:'Víz és kenyér',seconds:0},
    {kind:'wine',wine_index:1},{kind:'reveal',title:'Közös bemutató',message:'Két bor',wine_indexes:[0,1]}];
  const createAgenda=(steps:unknown=agenda)=>db.query<{id:string}>('select public.create_game_with_schedule($1,$2,$3,$4,$5,$6) id',
    [request,'Teljes menet',120,2,JSON.stringify(wines),JSON.stringify(steps)]);
  it('sorrend és többboros felfedés együtt menthető; ismétlés nem dupláz és nem írja vissza a későbbi szerkesztést',async()=>{
    const id=(await createAgenda()).rows[0].id;
    const p=(await db.query<{p:{version:number;steps:{id:string;kind:string;reveal_round_ids:string[]}[]}}>('select public.get_tasting_schedule($1) p',[id])).rows[0].p;
    expect(p.steps.map(s=>s.kind)).toEqual(['wine','break','wine','reveal']);
    expect(p.steps[3].reveal_round_ids).toEqual([p.steps[0].id,p.steps[2].id]);
    await db.query('select public.save_tasting_schedule($1,$2,gen_random_uuid(),$3)',[id,p.version,JSON.stringify(p.steps.filter(s=>s.kind==='wine').map((s,i)=>({...s,title:wines[i].name,seconds:0,price_huf:wines[i].price_huf,alcohol_tenths:wines[i].alcohol_tenths})))]);
    expect((await createAgenda()).rows[0].id).toBe(id);
    expect((await db.query<{p:{steps:unknown[]}}>('select public.get_tasting_schedule($1) p',[id])).rows[0].p.steps).toHaveLength(2);
    await expect(createAgenda(agenda.slice(0,3))).rejects.toThrow('REQUEST_ID_CONFLICT');
  });
  it('hibás, üres vagy későbbi borra mutató felfedésnél az egész létrehozás visszagördül',async()=>{
    for(const indexes of [[],[1],[0,0],[-1],[20]]) {
      await expect(createAgenda([agenda[0],{...agenda[3],wine_indexes:indexes},agenda[2]])).rejects.toThrow();
      expect((await db.query('select * from public.games')).rows).toHaveLength(0);
    }
    await expect(createAgenda([agenda[0],agenda[0]])).rejects.toThrow('INVALID_SCHEDULE');
    await asUser(guest);await expect(createAgenda()).rejects.toThrow('PERMANENT_AUTH_REQUIRED');
    await asUser(host,'authenticated','aal1');await expect(createAgenda()).rejects.toThrow(/MFA/);
  });
});
