import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadDatabase } from '../scripts/database-harness.mjs';

const db = new PGlite();
const admin = '00000000-0000-0000-0000-000000000001';
const googlePlayer = '00000000-0000-0000-0000-000000000002';
const guest = '00000000-0000-0000-0000-000000000003';
const wines = JSON.stringify([{ name: 'Titkos bor', price_huf: 4500, alcohol_tenths: 125 }]);

async function asUser(id: string, aal: string | null, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.query("select set_config('request.jwt.claim.aal', $1, false)", [aal ?? '']);
  await db.exec(`set role ${role}`);
}
async function createGame(title = 'Pénteki kóstoló') {
  return (await db.query<{ id: string }>('select public.create_game(gen_random_uuid(),$1,120,2,$2::jsonb) as id',
    [title, wines])).rows[0].id;
}

beforeAll(async () => { await loadDatabase(db); });
beforeEach(async () => {
  await db.exec(`reset role; truncate auth.users cascade;
    insert into auth.users (id, is_anonymous, raw_app_meta_data) values
      ('${admin}', false, '{"vakkostolo_role":"superadmin"}'),
      ('${googlePlayer}', false, '{"provider":"google"}'),
      ('${guest}', true, '{}');`);
});
afterAll(async () => { await db.close(); });

describe('játékmester csak superadmin, kétlépcsős azonosítással', () => {
  it('superadmin aal2 munkamenettel kóstolót hoz létre, listáz és meghívót ad ki', async () => {
    await asUser(admin, 'aal2');
    const game = await createGame();
    expect((await db.query('select * from public.list_host_games()')).rows).toHaveLength(1);
    await expect(db.query('select public.issue_invite($1)', [game])).resolves.toBeDefined();
  });
  it('superadmin második faktor nélkül (aal1 vagy hiányzó claim) nem játékmester', async () => {
    for (const aal of ['aal1', null]) {
      await asUser(admin, aal);
      await expect(createGame()).rejects.toThrow(/MFA_REQUIRED/);
      await expect(db.query('select * from public.list_host_games()')).rejects.toThrow(/MFA_REQUIRED/);
    }
  });
  it('Google-fiókos játékos még aal2-vel sem lehet játékmester', async () => {
    await asUser(googlePlayer, 'aal2');
    await expect(createGame()).rejects.toThrow(/HOST_ROLE_REQUIRED/);
    await expect(db.query('select * from public.list_host_games()')).rejects.toThrow(/HOST_ROLE_REQUIRED/);
  });
  it('a szerepet nem a JWT, hanem az Auth-sor adja; anonim és kijelentkezett hívás tiltott', async () => {
    await asUser(guest, 'aal2');
    await expect(createGame()).rejects.toThrow(/PERMANENT_AUTH_REQUIRED/);
    await asUser('', null, 'anon');
    await expect(createGame()).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    await db.query("update auth.users set raw_app_meta_data = '{}' where id = $1", [admin]);
    await asUser(admin, 'aal2');
    await expect(createGame()).rejects.toThrow(/HOST_ROLE_REQUIRED/);
  });
  it('a Google-fiókos játékos a superadmin kóstolójába beléphet', async () => {
    await asUser(admin, 'aal2');
    const game = await createGame();
    const { token } = (await db.query<{ data: { token: string } }>('select public.issue_invite($1) as data', [game])).rows[0].data;
    await asUser(googlePlayer, 'aal1');
    const joined = (await db.query<{ data: { game_id: string } }>('select public.join_game($1, $2) as data', [token, 'Anna'])).rows[0].data;
    expect(joined.game_id).toBe(game);
  });
});

describe('before_user_created Auth hook: nincs nyilvános jelszavas regisztráció', () => {
  async function hook(appMetadata: Record<string, unknown>) {
    await db.exec('reset role; set role supabase_auth_admin');
    const result = (await db.query<{ r: Record<string, unknown> }>('select private.before_user_created($1::jsonb) as r',
      [JSON.stringify({ user: { app_metadata: appMetadata } })])).rows[0].r;
    await db.exec('reset role');
    return result;
  }
  it('nyilvános e-mail-regisztrációt elutasít, a titkos kulccsal létrehozott superadmint engedi', async () => {
    expect(await hook({ provider: 'email', providers: ['email'] })).toMatchObject({ error: { http_code: 403 } });
    expect(await hook({ provider: 'email', vakkostolo_role: 'superadmin' })).toEqual({});
  });
  it('Google- és anonim játékost enged', async () => {
    expect(await hook({ provider: 'google', providers: ['google'] })).toEqual({});
    expect(await hook({ provider: 'anonymous' })).toEqual({});
    expect(await hook({})).toEqual({});
  });
  it('a hookot bejelentkezett felhasználó nem hívhatja', async () => {
    await asUser(googlePlayer, 'aal1');
    await expect(db.query("select private.before_user_created('{}'::jsonb)")).rejects.toThrow(/permission denied/);
  });
});
