import { loadDatabase } from '../scripts/database-harness.mjs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const host = '00000000-0000-0000-0000-000000000001';
const guest = '00000000-0000-0000-0000-000000000002';
const other = '00000000-0000-0000-0000-000000000003';
const outsider = '00000000-0000-0000-0000-000000000004';
const game = '10000000-0000-0000-0000-000000000001';
const otherGame = '10000000-0000-0000-0000-000000000002';
const round = '20000000-0000-0000-0000-000000000001';
const otherRound = '20000000-0000-0000-0000-000000000002';
const participant = '30000000-0000-0000-0000-000000000001';
const db = new PGlite();

async function asUser(uid: string, role = 'authenticated', aal = 'aal2') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await db.query("select set_config('request.jwt.claim.aal', $1, false)", [aal]);
  // role is a test constant, never user input.
  await db.exec(`set role ${role}`);
}

beforeAll(async () => { await loadDatabase(db); });

beforeEach(async () => {
  await db.exec(`reset role;
    truncate auth.users cascade;
    insert into auth.users(id) values ('${host}'), ('${guest}'), ('${other}'), ('${outsider}'); update auth.users set raw_app_meta_data = '{"vakkostolo_role":"superadmin"}' where not is_anonymous;
    insert into public.games(id, host_id, title, status) values
      ('${game}', '${host}', 'Teszt', 'tasting'), ('${otherGame}', '${outsider}', 'Másik', 'tasting');
    insert into public.participants(id, game_id, user_id, nickname) values
      ('${participant}', '${game}', '${guest}', 'Vendég'),
      (gen_random_uuid(), '${game}', '${other}', 'Másik vendég'),
      (gen_random_uuid(), '${otherGame}', '${outsider}', 'Kívülálló');
    update public.participants set joined_at = now() - interval '2 minutes';
    insert into public.rounds(id, game_id, position, status, opened_at, closes_at) values
      ('${round}', '${game}', 1, 'open', now() - interval '1 minute', now() + interval '5 minutes'),
      ('${otherRound}', '${otherGame}', 1, 'open', now() - interval '1 minute', now() + interval '5 minutes');
    insert into public.wine_secrets(round_id, game_id, name, price_huf, alcohol_tenths)
      values ('${round}', '${game}', 'Titkos bor', 5000, 135);
  `);
});
afterAll(async () => { await db.close(); });

describe('adatbázis jogosultsági határok', () => {
  it('tag csak a saját játékot látja, a titkos boradatot nem', async () => {
    await asUser(guest);
    expect((await db.query('select * from public.games')).rows).toHaveLength(1);
    expect((await db.query('select * from public.wine_secrets')).rows).toHaveLength(0);
    expect((await db.query('select * from public.rounds')).rows).toHaveLength(1);
    await asUser(host);
    expect((await db.query('select * from public.wine_secrets')).rows).toHaveLength(1);
    await asUser(outsider);
    expect((await db.query('select * from public.wine_secrets')).rows).toHaveLength(0);
  });
  it('a signed-out szerep nem olvashat és RPC-t sem hívhat', async () => {
    await asUser('', 'anon');
    await expect(db.query('select * from public.games')).rejects.toThrow(/permission denied/);
    await expect(db.query('select public.submit_rating($1,5000,135,8)', [round])).rejects.toThrow(/permission denied/);
  });
  it('a közvetlen írás a host és a játékos számára is tiltott', async () => {
    for (const user of [host, guest]) {
      await asUser(user);
      await expect(db.query("update public.rounds set status = 'revealed' where id = $1", [round])).rejects.toThrow(/permission denied/);
      await expect(db.query('delete from public.ratings')).rejects.toThrow(/permission denied/);
      await expect(db.query('insert into public.ratings(game_id,round_id,participant_id,price_huf,alcohol_tenths,liking) values($1,$2,$3,1,1,1)', [game, round, participant])).rejects.toThrow(/permission denied/);
    }
  });
  it('csak felfedés után ad ki pillanatképet és idegen válaszokat', async () => {
    await asUser(other);
    await db.query('select public.submit_rating($1,6000,140,7)', [round]);
    await asUser(guest);
    expect((await db.query('select * from public.ratings')).rows).toHaveLength(0);
    await db.exec(`reset role;
      insert into public.revealed_wines(round_id,game_id,name,price_huf,alcohol_tenths)
        select round_id,game_id,name,price_huf,alcohol_tenths from public.wine_secrets;`);
    await asUser(guest);
    expect((await db.query('select * from public.revealed_wines')).rows).toHaveLength(0);
    await db.exec(`reset role; update public.rounds set status = 'revealed' where id = '${round}';`);
    await asUser(guest);
    expect((await db.query('select * from public.revealed_wines')).rows).toHaveLength(1);
    expect((await db.query('select * from public.ratings')).rows).toHaveLength(1);
    expect((await db.query('select * from public.wine_secrets')).rows).toHaveLength(0);
    await asUser(outsider);
    expect((await db.query('select * from public.revealed_wines')).rows).toHaveLength(0);
    expect((await db.query('select * from public.ratings')).rows).toHaveLength(0);
  });
});

describe('biztonságos válaszbeküldés', () => {
  it('újrabeküldés ugyanazt a választ frissíti', async () => {
    await asUser(guest);
    await db.query('select public.submit_rating($1,5000,135,8)', [round]);
    await db.query('select public.submit_rating($1,6000,140,7)', [round]);
    const result = await db.query<{ price_huf: number }>('select price_huf from public.ratings');
    expect(result.rows).toEqual([{ price_huf: 6000 }]);
  });
  it('idegen játékba nem küldhet és hiányzó UID nem fogadható el', async () => {
    await asUser(guest);
    await expect(db.query('select public.submit_rating($1,5000,135,8)', [otherRound])).rejects.toThrow(/NOT_A_PARTICIPANT/);
    await asUser('');
    await expect(db.query('select public.submit_rating($1,5000,135,8)', [round])).rejects.toThrow(/AUTH_REQUIRED/);
  });
  it('a szerver akkor is elutasítja a lejárt választ, ha a kör még open', async () => {
    await db.exec(`update public.rounds set closes_at = now() - interval '1 second' where id = '${round}'`);
    await asUser(guest);
    await expect(db.query('select public.submit_rating($1,5000,135,8)', [round])).rejects.toThrow(/DEADLINE_PASSED/);
  });
  it('a host által korán lezárt kör nem fogad választ', async () => {
    await db.exec(`update public.rounds set status = 'closed' where id = '${round}'`);
    await asUser(guest);
    await expect(db.query('select public.submit_rating($1,5000,135,8)', [round])).rejects.toThrow(/ROUND_NOT_OPEN/);
  });
  it('hibás értéket az adatbázis korlátja is elutasít', async () => {
    await asUser(guest);
    await expect(db.query('select public.submit_rating($1,-1,135,8)', [round])).rejects.toThrow(/check constraint/);
    await expect(db.query('select public.submit_rating($1,5000,251,8)', [round])).rejects.toThrow(/check constraint/);
    await expect(db.query('select public.submit_rating($1,5000,135,0)', [round])).rejects.toThrow(/check constraint/);
  });
  it('nem lehet egyszerre két nyitott kör', async () => {
    await expect(db.query("insert into public.rounds(game_id,position,status,opened_at,closes_at) values($1,2,'open',now(),now()+interval '2 minutes')", [game])).rejects.toThrow(/unique constraint/);
  });
  it('összetett FK kizárja a játékokon átívelő választ', async () => {
    await expect(db.query('insert into public.ratings(game_id,round_id,participant_id,price_huf,alcohol_tenths,liking) values($1,$2,$3,5000,135,8)', [otherGame, otherRound, participant])).rejects.toThrow(/foreign key constraint/);
  });
});
