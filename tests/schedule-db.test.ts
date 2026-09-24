import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { loadDatabase } from '../scripts/database-harness.mjs';
const db = new PGlite();
const host = randomUUID(), guest = randomUUID(), other = randomUUID();
let game: string;
interface Step { id: string; kind: string; seconds: number; title: string; message: string; status: string; price_huf: number; alcohol_tenths: number; round_position: number }
interface Plan { version: number; status: string; steps: Step[] }
async function user(id: string, aal = 'aal2') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.aal',$2,false)", [id, aal]);
  await db.exec('set role authenticated');
}
async function plan() { return (await db.query<{ p: Plan }>('select public.get_tasting_schedule($1) p', [game])).rows[0].p; }
async function save(steps: unknown[], version: number, id = randomUUID()) {
  return db.query('select public.save_tasting_schedule($1,$2,$3,$4)', [game, version, id, JSON.stringify(steps)]);
}
async function command(action: string, seconds: number | null = null, version?: number, id = randomUUID()) {
  return db.query('select public.control_tasting($1,$2,$3,$4,$5)', [game, version ?? (await plan()).version, id, action, seconds]);
}
const pause = () => ({ id: randomUUID(), kind: 'break', title: 'Víz és kenyér', message: 'Tíz perc múlva folytatjuk. Titkos következő bor!', seconds: 600 });
beforeAll(async () => { await loadDatabase(db); });
beforeEach(async () => {
  await db.exec(`reset role; truncate auth.users cascade; insert into auth.users(id,is_anonymous,raw_app_meta_data)
    values ('${host}',false,'{"vakkostolo_role":"superadmin"}'),('${guest}',true,'{}'),('${other}',false,'{"vakkostolo_role":"superadmin"}');`);
  await user(host);
  game = (await db.query<{ id: string }>(`select public.create_game(gen_random_uuid(),'Szerkeszthető',120,2,
    '[{"name":"Titkos első","price_huf":4500,"alcohol_tenths":130},{"name":"Titkos második","price_huf":6000,"alcohol_tenths":140}]') id`)).rows[0].id;
  const token = (await db.query<{ t: { token: string } }>('select public.issue_invite($1) t', [game])).rows[0].t.token;
  await user(guest); await db.query('select public.join_game($1,\'Anna\')', [token]); await user(host);
});
afterAll(async () => { await db.close(); });
it('sorrend, új bor, eltávolítás és szünet atomikusan menthető; ismétlés nem dupláz', async () => {
  const p = await plan(), key = randomUUID(), b = pause();
  const added = { ...p.steps[0], id: randomUUID(), title: 'Új bor' };
  const input = [b, p.steps[1], added];
  await save(input, p.version, key); await save(input, p.version, key);
  const result = await plan(); expect(result.version).toBe(p.version+1);
  expect(result.steps.map(s => s.title)).toEqual([b.title, 'Titkos második', 'Új bor']);
  expect(result.steps.filter(s => s.kind === 'wine').map(s => s.round_position)).toEqual([1,2]);
  await expect(save(input, p.version)).rejects.toThrow('VERSION_CONFLICT');
  await expect(save([], p.version, key)).rejects.toThrow('REQUEST_ID_CONFLICT');
  await expect(save([], result.version)).rejects.toThrow('INVALID_SCHEDULE');
});
it('a szünet lehet az első lépés, csak az aktuális szöveg kerül a játékoshoz', async () => {
  const p = await plan(), b = pause(); await save([b, ...p.steps], p.version);
  await user(guest);
  const before = await db.query('select public.get_game_snapshot($1) s', [game]);
  expect(JSON.stringify(before.rows)).not.toMatch(/Titkos|kenyér/);
  await user(host); await command('start'); await user(guest);
  const after = (await db.query<{ s: { round: unknown; break: { title: string; message: string } } }>('select public.get_game_snapshot($1) s', [game])).rows[0].s;
  expect(after.round).toBeNull(); expect(after.break.message).toBe(b.message);
  expect(JSON.stringify(after)).not.toContain('Titkos első');
  await user(host); await command('next'); expect((await plan()).steps[1].status).toBe('open');
});
it('futó kör adatai zároltak, jövője átrendezhető, válasz és határidő megmarad', async () => {
  await command('start'); const p = await plan(), id = p.steps[0].id;
  await user(guest); await db.query('select public.submit_rating($1,5,130,8)', [id]); await user(host);
  await expect(save(p.steps, p.version)).rejects.toThrow('STEP_LOCKED');
  await save([pause(), { ...p.steps[1], seconds: 180 }], p.version);
  await user(guest);
  const data = (await db.query<{ s: { own_rating: { price_bucket: number } } }>('select public.get_game_snapshot($1) s', [game])).rows[0].s;
  expect(data.own_rating.price_bucket).toBe(5);
});
it('idő szerveroldali, idempotens, rövidíthető; lejárt kör nem nyitható újra', async () => {
  await command('start'); const p = await plan(), key = randomUUID();
  await command('time', 300, p.version, key);
  const first = (await db.query<{ closes_at: string }>('select closes_at from public.rounds where id=$1', [p.steps[0].id])).rows[0].closes_at;
  await command('time', 300, p.version, key);
  expect((await db.query<{closes_at:string}>('select closes_at from public.rounds where id=$1', [p.steps[0].id])).rows[0].closes_at).toEqual(first);
  await command('time', 30);
  await db.exec('reset role'); await db.query("update public.rounds set opened_at=now()-interval '2 minutes',closes_at=now()-interval '1 second' where id=$1", [p.steps[0].id]); await user(host);
  await expect(command('time', 100)).rejects.toThrow('DEADLINE_PASSED');
  await user(guest); await expect(db.query('select public.submit_rating($1,5,130,8)', [p.steps[0].id])).rejects.toThrow('DEADLINE_PASSED');
});
it('lezárás, szünet, következő bor és blokkos felfedés után befejezhető', async () => {
  const p = await plan(); await save([p.steps[0],pause(),p.steps[1]],p.version);
  await command('start'); await expect(command('next')).rejects.toThrow('ROUND_STILL_OPEN');
  await command('close'); await expect(command('reveal')).rejects.toThrow('BLOCK_INCOMPLETE');
  await command('next'); expect((await plan()).status).toBe('intermission');
  await command('next'); await command('close'); await command('reveal');
  await user(guest); const result = await db.query('select public.get_game_snapshot($1) s', [game]);
  expect(JSON.stringify(result.rows)).toContain('Titkos első');
  await user(host); await command('finish'); expect((await plan()).status).toBe('finished');
  await expect(save([], (await plan()).version)).rejects.toThrow('GAME_FINISHED');
});
it('más host, vendég és aal1 nem kezelhet; privát tábla nem olvasható', async () => {
  const p = await plan(); await user(other); await expect(plan()).rejects.toThrow('GAME_NOT_FOUND');
  await expect(save(p.steps,p.version)).rejects.toThrow('GAME_NOT_FOUND');
  await user(guest); await expect(command('start',null,p.version)).rejects.toThrow('PERMANENT_AUTH_REQUIRED');
  await expect(db.query('select * from private.tasting_steps')).rejects.toThrow(/permission denied/);
  await user(host,'aal1'); await expect(plan()).rejects.toThrow(/MFA/);
});
it('idegen és ismételt lépésazonosítók, érvénytelen idő és boradat visszagörgetnek', async () => {
  const p = await plan();
  await expect(save([p.steps[0],p.steps[0]],p.version)).rejects.toThrow('INVALID_SCHEDULE');
  await expect(save([{...p.steps[0],seconds:1},p.steps[1]],p.version)).rejects.toThrow('INVALID_SCHEDULE');
  await expect(save([{...p.steps[0],price_huf:0},p.steps[1]],p.version)).rejects.toThrow();
  expect((await plan()).version).toBe(p.version);
  await user(other); const otherGame=(await db.query<{id:string}>(`select public.create_game(gen_random_uuid(),'Más',120,2,'[{"name":"Másik","price_huf":3000,"alcohol_tenths":120}]') id`)).rows[0].id;
  const foreign=(await db.query<{p:Plan}>('select public.get_tasting_schedule($1) p',[otherGame])).rows[0].p.steps[0];
  await user(host); await expect(save([foreign],p.version)).rejects.toThrow('STEP_LOCKED');
});
it('teljes blokk után új bor csak felfedéssel indulhat; az utolsó kisebb blokk is felfedhető', async () => {
  const p = await plan(); await save([...p.steps,{...p.steps[1],id:randomUUID(),title:'Harmadik'}],p.version);
  await command('start'); await command('close'); await command('next'); await command('close');
  await expect(command('next')).rejects.toThrow('REVEAL_REQUIRED');
  await expect(command('finish')).rejects.toThrow('STEPS_REMAIN');
  await command('reveal'); await command('next'); await command('close'); await command('reveal'); await command('finish');
  expect((await plan()).steps.map(s=>s.status)).toEqual(['revealed','revealed','revealed']);
});
it('mentett draft is szerkeszthető, a bor egyedi idejével indul, kézi szünetnek nincs határideje', async () => {
  await db.exec('reset role'); await db.query("update public.games set status='draft' where id=$1",[game]); await user(host);
  const p=await plan(); await save([{...p.steps[0],seconds:240},{...pause(),seconds:0},p.steps[1]],p.version);
  await db.query('select public.issue_invite($1)',[game]); await command('start');
  const timing=(await db.query<{seconds:number}>("select extract(epoch from closes_at-opened_at)::integer seconds from public.rounds where id=$1",[p.steps[0].id])).rows[0];
  expect(timing.seconds).toBe(240); await command('close'); await command('next');
  await user(guest); const snapshot=(await db.query<{s:{break:{ends_at:null}}}>('select public.get_game_snapshot($1) s',[game])).rows[0].s;
  expect(snapshot.break.ends_at).toBeNull();
});
