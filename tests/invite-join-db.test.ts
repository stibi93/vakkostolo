import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadDatabase } from '../scripts/database-harness.mjs';

const db = new PGlite();
const host = '00000000-0000-0000-0000-000000000001';
const otherHost = '00000000-0000-0000-0000-000000000002';
const guest = '00000000-0000-0000-0000-000000000003';
const secondGuest = '00000000-0000-0000-0000-000000000004';
const request = '10000000-0000-0000-0000-000000000001';
const wines = [{ name: 'Titkos bor', price_huf: 4500, alcohol_tenths: 125 }];
let game: string;

async function asUser(id: string, role = 'authenticated', aal = 'aal2') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.query("select set_config('request.jwt.claim.aal', $1, false)", [aal]);
  await db.exec(`set role ${role}`);
}
async function issue(id = game) {
  return (await db.query<{ data: { token: string; expires_at: string; status: string } }>(
    'select public.issue_invite($1) as data', [id])).rows[0].data;
}
async function join(token: string, nickname: string | null = 'Anna') {
  return (await db.query<{ data: Record<string, string> }>('select public.join_game($1,$2) as data',
    [token, nickname])).rows[0].data;
}
async function asAdmin<T>(sql: string, params: unknown[] = []) {
  await db.exec('reset role');
  return (await db.query<T>(sql, params)).rows;
}

beforeAll(async () => { await loadDatabase(db); });
beforeEach(async () => {
  await db.exec(`reset role; truncate auth.users cascade;
    insert into auth.users (id,is_anonymous) values
      ('${host}',false),('${otherHost}',false),('${guest}',true),('${secondGuest}',true); update auth.users set raw_app_meta_data = '{"vakkostolo_role":"superadmin"}' where not is_anonymous;`);
  await asUser(host);
  game = (await db.query<{ id: string }>('select public.create_game($1,$2,120,2,$3::jsonb) as id',
    [request, 'Péntesti kóstoló', JSON.stringify(wines)])).rows[0].id;
});
afterAll(async () => { await db.close(); });

describe('issue_invite: váró megnyitása és meghívó', () => {
  it('draft játékot váróba tesz, és csak a token hash-ét tárolja', async () => {
    const invite = await issue();
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(invite.status).toBe('lobby');
    const [stored] = await asAdmin<{ token_hash: string; status: string; version: number }>(
      'select i.token_hash, g.status, g.version from public.game_invites i join public.games g on g.id = i.game_id');
    expect(stored.status).toBe('lobby');
    expect(stored.version).toBe(1);
    expect(stored.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.token_hash).not.toContain(invite.token);
    expect(await asAdmin('select event_type from public.game_events order by created_at'))
      .toEqual([{ event_type: 'game_created' }, { event_type: 'lobby_opened' }]);
  });
  it('új meghívó érvényteleníti a régit, a váró állapota nem változik újra', async () => {
    const first = await issue();
    const second = await issue();
    expect(second.token).not.toBe(first.token);
    expect((await asAdmin<{ version: number }>('select version from public.games'))[0].version).toBe(1);
    await asUser(guest);
    await expect(join(first.token)).rejects.toThrow(/INVITE_INVALID/);
    expect((await join(second.token)).game_id).toBe(game);
  });
  it('más host, anonim felhasználó és kijelentkezett szerep nem ad ki meghívót', async () => {
    await asUser(otherHost);
    await expect(issue()).rejects.toThrow(/GAME_NOT_FOUND/);
    await asUser(guest);
    await expect(issue()).rejects.toThrow(/PERMANENT_AUTH_REQUIRED/);
    await asUser('', 'anon');
    await expect(issue()).rejects.toThrow(/permission denied/);
  });
  it('befejezett játékhoz nem ad ki meghívót', async () => {
    await asAdmin("update public.games set status = 'finished'");
    await asUser(host);
    await expect(issue()).rejects.toThrow(/GAME_FINISHED/);
  });
});

describe('join_game: vendégbelépés meghívóval', () => {
  it('anonim vendég becenévvel belép, és csak a saját játékát látja, titkos bor nélkül', async () => {
    const { token } = await issue();
    await asUser(guest);
    const membership = await join(token, '  Anna  ');
    expect(membership).toMatchObject({ game_id: game, nickname: 'Anna', title: 'Péntesti kóstoló', status: 'lobby' });
    expect(Object.keys(membership).sort()).toEqual(['game_id', 'nickname', 'participant_id', 'reclaim_saved', 'status', 'title']);
    expect(membership.reclaim_saved).toBe(false);
    expect((await db.query('select id from public.games')).rows).toEqual([{ id: game }]);
    expect((await db.query('select * from public.wine_secrets')).rows).toHaveLength(0);
    expect((await db.query('select * from public.game_invites')).rows).toHaveLength(0);
  });
  it('ismételt belépés és becenév nélküli visszatérés ugyanazt a tagságot adja', async () => {
    const { token } = await issue();
    await asUser(guest);
    const first = await join(token, 'Anna');
    expect(await join(token, 'Másik név')).toEqual(first);
    expect(await join(token, null)).toEqual(first);
    expect(await asAdmin('select nickname from public.participants')).toEqual([{ nickname: 'Anna' }]);
  });
  it('becenév nélkül nem hoz létre új résztvevőt', async () => {
    const { token } = await issue();
    await asUser(guest);
    await expect(join(token, null)).rejects.toThrow(/NICKNAME_REQUIRED/);
    await expect(join(token, '   ')).rejects.toThrow(/NICKNAME_REQUIRED/);
    expect(await asAdmin('select * from public.participants')).toHaveLength(0);
  });
  it.each(['x'.repeat(31), 'Anna\nBéla'])('hibás becenevet elutasít: %j', async (nickname) => {
    const { token } = await issue();
    await asUser(guest);
    await expect(join(token, nickname)).rejects.toThrow(/INVALID_NICKNAME/);
  });
  it('hibás, lejárt vagy ismeretlen linket egyformán elutasít', async () => {
    const { token } = await issue();
    await asUser(guest);
    for (const bad of ['rövid', `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`, `${token}x`]) {
      await expect(join(bad)).rejects.toThrow(/INVITE_INVALID/);
    }
    await asAdmin("update public.game_invites set expires_at = now() - interval '1 second', created_at = now() - interval '1 day'");
    await asUser(guest);
    await expect(join(token)).rejects.toThrow(/INVITE_INVALID/);
  });
  it('a host a saját játékába nem léphet be játékosként', async () => {
    const { token } = await issue();
    await expect(join(token)).rejects.toThrow(/HOST_CANNOT_JOIN/);
  });
  it('bejelentkezés nélkül nem lehet belépni', async () => {
    const { token } = await issue();
    await asUser('');
    await expect(join(token)).rejects.toThrow(/AUTH_REQUIRED/);
    await asUser('', 'anon');
    await expect(join(token)).rejects.toThrow(/permission denied/);
  });
  it('lezárt játékba új játékos nem léphet, a meglévő tag visszatérhet', async () => {
    const { token } = await issue();
    await asUser(guest);
    const membership = await join(token);
    await asAdmin("update public.games set status = 'finished'");
    await asUser(secondGuest);
    await expect(join(token, 'Béla')).rejects.toThrow(/GAME_CLOSED/);
    await asUser(guest);
    expect((await join(token, null)).participant_id).toBe(membership.participant_id);
  });
  it('késői belépés futó kóstolónál megengedett', async () => {
    const { token } = await issue();
    await asAdmin("update public.games set status = 'tasting'");
    await asUser(guest);
    expect((await join(token)).status).toBe('tasting');
  });
  it('legfeljebb 50 résztvevőt enged', async () => {
    const { token } = await issue();
    await asAdmin('insert into auth.users (id,is_anonymous) select gen_random_uuid(), true from generate_series(1,50)');
    await asAdmin(`insert into public.participants(game_id,user_id,nickname)
      select $1, id, 'Vendég' from auth.users where is_anonymous and id not in ('${guest}','${secondGuest}')`, [game]);
    await asUser(guest);
    await expect(join(token)).rejects.toThrow(/GAME_FULL/);
  });
  it('a vendég a résztvevőket látja, más játékét nem, és közvetlenül nem írhat', async () => {
    const { token } = await issue();
    await asUser(guest);
    await join(token, 'Anna');
    await asUser(secondGuest);
    await join(token, 'Béla');
    await asUser(otherHost);
    const otherGame = (await db.query<{ id: string }>('select public.create_game($1,$2,120,2,$3::jsonb) as id',
      ['10000000-0000-0000-0000-000000000002', 'Másik', JSON.stringify(wines)])).rows[0].id;
    const other = await issue(otherGame);
    await asUser(guest);
    expect((await db.query('select nickname from public.participants order by nickname')).rows)
      .toEqual([{ nickname: 'Anna' }, { nickname: 'Béla' }]);
    expect((await db.query('select id from public.games')).rows).toEqual([{ id: game }]);
    await expect(db.query("insert into public.participants(game_id,user_id,nickname) values ($1,$2,'X')",
      [otherGame, guest])).rejects.toThrow(/permission denied/);
    expect((await join(other.token, 'Anna')).game_id).toBe(otherGame);
  });
});

describe('preview_invite: kóstoló azonosítása belépés előtt', () => {
  async function preview(token: string) {
    return (await db.query<{ data: Record<string, unknown> }>('select public.preview_invite($1) as data', [token])).rows[0].data;
  }
  it('bejelentkezés nélkül csak a címet és a belépés lehetőségét adja vissza', async () => {
    const { token } = await issue();
    await asUser('', 'anon');
    expect(await preview(token)).toEqual({ title: 'Péntesti kóstoló', joinable: true });
    expect(await asAdmin('select count(*)::int as n from public.participants')).toEqual([{ n: 0 }]);
    expect(await asAdmin('select count(*)::int as n from auth.users')).toEqual([{ n: 4 }]);
  });
  it('hibás, lecserélt vagy lejárt linket egyformán elutasít', async () => {
    const first = await issue();
    const second = await issue();
    await asUser('', 'anon');
    for (const token of ['rovid', 'A'.repeat(43), first.token]) {
      await expect(preview(token)).rejects.toThrow(/INVITE_INVALID/);
    }
    await asAdmin("update public.game_invites set expires_at = now() - interval '1 second', created_at = now() - interval '1 day'");
    await asUser('', 'anon');
    await expect(preview(second.token)).rejects.toThrow(/INVITE_INVALID/);
  });
  it('befejezett kóstolónál jelzi, hogy új játékos már nem léphet be', async () => {
    const { token } = await issue();
    await asAdmin("update public.games set status = 'finished'");
    await asUser(guest);
    expect(await preview(token)).toEqual({ title: 'Péntesti kóstoló', joinable: false });
  });
});

describe('helykulcs: elveszett anonim belépés ugyanahhoz a játékoshoz tér vissza', () => {
  const secret = 'S'.repeat(43);
  const otherSecret = 'T'.repeat(43);
  async function joinWith(token: string, nickname: string | null, reclaim: string | null = null) {
    return (await db.query<{ data: Record<string, unknown> }>('select public.join_game($1,$2,$3) as data',
      [token, nickname, reclaim])).rows[0].data;
  }
  async function resume(reclaim = secret) {
    return (await db.query<{ data: Record<string, unknown> }>('select public.resume_membership($1,$2) as data',
      [game, reclaim])).rows[0].data;
  }
  it('lejárt meghívó után az új anonim belépés a régi helyet, tippet és időt kapja vissza', async () => {
    const { token } = await issue();
    await asUser(guest);
    const first = await joinWith(token, 'Anna', secret);
    expect(first.reclaim_saved).toBe(true);
    const [round] = await asAdmin<{ id: string }>('select id from public.rounds');
    await asAdmin(`update public.participants set joined_at = now() - interval '2 hours' where id = $1`, [first.participant_id]);
    await asAdmin(`insert into public.ratings(game_id, round_id, participant_id, price_bucket, alcohol_tenths, liking)
      values ($1,$2,$3,4,120,8)`, [game, round.id, first.participant_id]);
    await asAdmin("update public.game_invites set expires_at = now() - interval '1 second', created_at = now() - interval '1 day'");
    await asUser(secondGuest);
    await expect(joinWith(token, 'Anna', secret)).rejects.toThrow(/INVITE_INVALID/);
    const back = await resume();
    expect(back).toMatchObject({ participant_id: first.participant_id, nickname: 'Anna', reclaim_saved: true });
    const seats = await asAdmin<{ user_id: string; nickname: string; ratings: number; age: string }>(
      `select p.user_id::text, p.nickname, (select count(*)::int from public.ratings r where r.participant_id = p.id) as ratings,
        extract(epoch from (now() - p.joined_at))::int::text as age from public.participants p`);
    expect(seats).toEqual([{ user_id: secondGuest, nickname: 'Anna', ratings: 1, age: expect.any(String) }]);
    expect(Number(seats[0].age)).toBeGreaterThan(60 * 60);
    await asUser(secondGuest);
    await expect(db.query('select * from private.participant_reclaims')).rejects.toThrow(/permission denied/);
  });
  it('kulcs nélkül új játékos lesz, Google-helyet a kulcs nem vesz át, üres duplikátumot igen', async () => {
    const { token } = await issue();
    await asUser(guest);
    const first = await joinWith(token, 'Anna', secret);
    await asUser(secondGuest);
    const created = await joinWith(token, 'Béla');
    expect(created.participant_id).not.toBe(first.participant_id);
    expect(await asAdmin('select count(*)::int as n from public.participants')).toEqual([{ n: 2 }]);
    await asAdmin('delete from public.participants where id = $1', [created.participant_id]);
    await asAdmin('update auth.users set is_anonymous = false where id = $1', [guest]);
    await asUser(secondGuest);
    await expect(resume()).rejects.toThrow(/RECLAIM_DENIED/);
    await asAdmin('update auth.users set is_anonymous = true where id = $1', [guest]);
    await asUser(secondGuest);
    const duplicate = await joinWith(token, 'Anna', otherSecret);
    const back = await resume();
    expect(back.participant_id).toBe(first.participant_id);
    expect(await asAdmin('select id, user_id from public.participants')).toEqual([{ id: first.participant_id, user_id: secondGuest }]);
    expect(duplicate.participant_id).not.toBe(first.participant_id);
  });
  it('hibás kulcs és a host nem veszi át a helyet', async () => {
    const { token } = await issue();
    await asUser(guest);
    await joinWith(token, 'Anna', secret);
    await asUser(secondGuest);
    await expect(resume('Z'.repeat(43))).rejects.toThrow(/RECLAIM_INVALID/);
    await asUser(host);
    await expect(resume()).rejects.toThrow(/HOST_CANNOT_JOIN/);
    expect(await asAdmin('select user_id from public.participants')).toEqual([{ user_id: guest }]);
  });
});
