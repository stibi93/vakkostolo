import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { loadDatabase } from '../scripts/database-harness.mjs';

const db = new PGlite();
const host = randomUUID(), guest = randomUUID();
async function user(id: string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.aal','aal2',false)", [id]);
  await db.exec('set role authenticated');
}
interface Step { id: string; title: string; status: string }
beforeAll(async () => { await loadDatabase(db); });
afterAll(async () => { await db.close(); });
it('átrendezéskor a fotó a borhoz kötve marad; csak a valódi blokkfelfedés engedi a játékosnak', async () => {
  await db.query(`insert into auth.users(id,is_anonymous,raw_app_meta_data) values
    ($1,false,'{"vakkostolo_role":"superadmin"}'),($2,true,'{}')`, [host, guest]);
  await user(host);
  const game = (await db.query<{ id: string }>(`select public.create_game(gen_random_uuid(),'Fotós menet',120,2,
    '[{"name":"Első bor","price_huf":4500,"alcohol_tenths":130},{"name":"Második bor","price_huf":6000,"alcohol_tenths":140}]') id`)).rows[0].id;
  async function plan() {
    return (await db.query<{ p: { version: number; steps: Step[] } }>('select public.get_tasting_schedule($1) p', [game])).rows[0].p;
  }
  async function control(action: string) {
    await user(host);
    await db.query('select public.control_tasting($1,$2,$3,$4,null)', [game, (await plan()).version, randomUUID(), action]);
  }
  const original = await plan(), photographed = original.steps[0].id;
  const path = `${game}/${photographed}.jpg`;
  await db.query("insert into storage.objects(bucket_id,name) values ('wine-photos',$1)", [path]);
  const token = (await db.query<{ t: { token: string } }>('select public.issue_invite($1) t', [game])).rows[0].t.token;
  await user(guest); await db.query('select public.join_game($1,$2)', [token, 'Tesztvendég']);
  await user(host);
  const current = await plan();
  await db.query('select public.save_tasting_schedule($1,$2,$3,$4)', [game, current.version, randomUUID(), JSON.stringify([...current.steps].reverse())]);
  const wines = (await db.query<{ g: { wines: { round_id: string; position: number; photo_updated_at: string | null }[] } }>('select public.get_host_game($1) g', [game])).rows[0].g.wines;
  expect(wines[1]).toMatchObject({ round_id: photographed, position: 2 });
  expect(wines[1].photo_updated_at).not.toBeNull();
  expect(wines[0].photo_updated_at).toBeNull();
  await user(guest);
  expect((await db.query('select name from storage.objects')).rows).toEqual([]);
  const hidden = JSON.stringify((await db.query('select public.get_game_snapshot($1)', [game])).rows);
  expect(hidden).not.toMatch(/photo|\.jpg|Első bor|Második bor/);
  for (const action of ['start', 'close', 'next', 'close']) await control(action);
  await user(guest);
  expect((await db.query('select name from storage.objects')).rows).toEqual([]);
  await control('reveal');
  await user(guest);
  expect((await db.query('select name from storage.objects')).rows).toEqual([{ name: path }]);
  await user(host);
  expect((await db.query('delete from storage.objects where name=$1', [path])).affectedRows).toBe(0);
});
