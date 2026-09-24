import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { loadDatabase } from '../scripts/database-harness.mjs';
import { parseGameSnapshot } from '../src/live/api';
import { parseResults } from '../src/results/api';
import type { HostQuestion } from '../src/questions/model';
import type { TastingSchedule } from '../src/schedule/model';
const db = new PGlite();
const host=randomUUID(),guest=randomUUID(),other=randomUUID();
let game:string, round:string;
const question:HostQuestion={id:'grape',prompt:'Melyik szőlőfajta?',options:[{id:'a',label:'Furmint'},{id:'b',label:'Rizling'}],correctOptionId:'a'};
async function user(id:string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal','aal2',false)",[id]);
  await db.exec('set role authenticated');
}
async function plan() {return (await db.query<{p:TastingSchedule}>('select public.get_tasting_schedule($1) p',[game])).rows[0].p;}
async function snapshot() {return (await db.query<{s:Record<string,unknown>}>('select public.get_game_snapshot($1) s',[game])).rows[0].s;}
async function command(action:string) {await user(host);const p=await plan();await db.query('select public.control_tasting($1,$2,$3,$4)',[game,p.version,randomUUID(),action]);}
async function submit(answers:unknown, bucket=5) {return db.query('select public.submit_rating_with_questions($1,$2,130,8,$3) r',[round,bucket,JSON.stringify(answers)]);}
async function create(questions:unknown, request=randomUUID()) {
 return db.query<{id:string}>(`select public.create_game_with_schedule($1,'Kérdések',0,2,$2,$3) id`,[request,JSON.stringify([{name:'Titkos bor',price_huf:4500,alcohol_tenths:130,questions}]),JSON.stringify([{kind:'wine',wine_index:0},{kind:'reveal',title:'Bemutató',message:'',wine_indexes:[0]}])]);
}
beforeAll(async()=>{await loadDatabase(db);});
beforeEach(async()=>{
 await db.exec(`reset role; truncate auth.users cascade; insert into auth.users(id,is_anonymous,raw_app_meta_data) values ('${host}',false,'{"vakkostolo_role":"superadmin"}'),('${guest}',true,'{}'),('${other}',true,'{}');`);
 await user(host);game=(await create([question])).rows[0].id;round=(await plan()).steps[0].id;
 const token=(await db.query<{t:{token:string}}>('select public.issue_invite($1) t',[game])).rows[0].t.token;
 await user(guest);await db.query("select public.join_game($1,'Anna')",[token]);await user(host);
});
afterAll(async()=>{await db.close();});
it('kérdések tartósan mentve; ismételt létrehozás nem dupláz; hibás kérdés atomikusan elutasítva',async()=>{
 expect((await plan()).steps[0].questions).toEqual([question]);
 const key=randomUUID();const first=await create([question],key);expect((await create([question],key)).rows).toEqual(first.rows);
 await expect(create([{...question,correctOptionId:'missing'}],key)).rejects.toThrow('REQUEST_ID_CONFLICT');
 const count=(await db.query('select count(*) from public.games')).rows;
 for(const bad of [null,{},[question,question],[{...question,options:[]}],[{...question,prompt:''}],[{...question,correctOptionId:null}],[{...question,options:[question.options[0],{id:'b',label:' furmint '}]}]]) await expect(create(bad)).rejects.toThrow('INVALID_QUESTIONS');
 expect((await db.query('select count(*) from public.games')).rows).toEqual(count);
});
it('nyitott körben csak kérdés és opciók; helyes válasz, rejtett bor és más játékos válasza nem szivárog',async()=>{
 await user(guest);expect(JSON.stringify(await snapshot())).not.toContain(question.prompt);
 await command('start');await user(guest);
 const dto=await snapshot(), parsed=parseGameSnapshot(dto,game);
 expect(parsed.round?.questions).toEqual([{id:question.id,prompt:question.prompt,options:question.options}]);
 expect(JSON.stringify(dto)).not.toMatch(/correctOptionId|Titkos bor/);
 await expect(db.query('select * from private.wine_questions')).rejects.toThrow();
 await expect(db.query('select private.submit_base_rating($1,5,130,8)',[round])).rejects.toThrow();
 await user(other);await expect(snapshot()).rejects.toThrow();await expect(submit({grape:'a'})).rejects.toThrow('NOT_A_PARTICIPANT');
});
it('hiányzó, idegen és régi kliensválasz tiltott; atomi felülírás és újratöltés',async()=>{
 await command('start');await user(guest);
 for(const bad of [{},{grape:'x'},{grape:'a',extra:'b'},null,[]]) await expect(submit(bad)).rejects.toThrow('INVALID_ANSWERS');
 await expect(db.query('select public.submit_rating($1,5,130,8)',[round])).rejects.toThrow('INVALID_ANSWERS');
 expect((await snapshot()).own_rating).toBeNull();
 await submit({grape:'b'});await submit({grape:'a'},6);
 const own=parseGameSnapshot(await snapshot(),game).ownRating;
 expect(own?.customAnswers).toEqual({grape:'a'});expect(own?.priceBucket).toBe(6);
 await expect(submit({grape:'unknown'},7)).rejects.toThrow('INVALID_ANSWERS');
 expect(parseGameSnapshot(await snapshot(),game).ownRating).toEqual(own);
 await user(host);expect((await snapshot()).own_rating).toBeNull();
});
it('csak a felfedésnél értékel, ranglista változatlan; host saját válasz nélkül',async()=>{
 await command('start');await user(guest);await submit({grape:'b'});
 await command('close');await user(guest);expect(JSON.stringify(await snapshot())).not.toContain('correctOptionId');
 await command('next');await user(guest);
 const result=parseGameSnapshot(await snapshot(),game).results!;
 expect(result.wines[0].questions).toEqual([{...question,ownOptionId:'b'}]);expect(result.leaderboard[0].points).toBe(100);
 await user(host);
 const raw=(await db.query<{r:unknown}>('select public.get_game_results($1) r',[game])).rows[0].r;
 expect(parseResults(raw,'host').wines[0].questions?.[0].ownOptionId).toBeNull();
 await user(other);await expect(db.query('select public.get_game_results($1)',[game])).rejects.toThrow();
});
it('szerkesztés és kérdéstörlés csak indulás előtt; lejárt beküldés elutasítva',async()=>{
 let p=await plan();p.steps[0].questions=[];
 await db.query('select public.save_tasting_schedule($1,$2,$3,$4)',[game,p.version,randomUUID(),JSON.stringify(p.steps)]);
 expect((await plan()).steps[0].questions).toEqual([]);
 p=await plan();p.steps[0].questions=[question];const request=randomUUID();
 await db.query('select public.save_tasting_schedule($1,$2,$3,$4)',[game,p.version,request,JSON.stringify(p.steps)]);
 await command('start');
 await db.query('select public.save_tasting_schedule($1,$2,$3,$4)',[game,p.version,request,JSON.stringify(p.steps)]);
 const started=await plan();await expect(db.query('select public.save_tasting_schedule($1,$2,$3,$4)',[game,started.version,randomUUID(),JSON.stringify(started.steps)])).rejects.toThrow('STEP_LOCKED');
 await db.exec('reset role');await db.query("update public.rounds set opened_at=now()-interval '2 minutes',closes_at=now()-interval '1 second' where id=$1",[round]);await user(guest);
 await expect(submit({grape:'a'})).rejects.toThrow('DEADLINE_PASSED');
});
it('két játékos válaszai elkülönülnek; későbbi bor kérdése és megfejtése rejtett marad',async()=>{
 const p=await plan();const nextId=randomUUID();
 const next={...p.steps[0],id:nextId,title:'Második titkos bor',questions:[{...question,prompt:'Későbbi titkos kérdés',correctOptionId:'b'}]};
 await db.query('select public.save_tasting_schedule($1,$2,$3,$4)',[game,p.version,randomUUID(),JSON.stringify([...p.steps,next])]);
 const token=(await db.query<{t:{token:string}}>('select public.issue_invite($1) t',[game])).rows[0].t.token;
 await user(other);await db.query("select public.join_game($1,'Béla')",[token]);
 await command('start');await user(guest);await submit({grape:'a'});await user(other);await submit({grape:'b'});
 expect(parseGameSnapshot(await snapshot(),game).ownRating?.customAnswers).toEqual({grape:'b'});
 await user(guest);expect(parseGameSnapshot(await snapshot(),game).ownRating?.customAnswers).toEqual({grape:'a'});
 expect(JSON.stringify(await snapshot())).not.toMatch(/Későbbi titkos kérdés|Második titkos bor/);
 await command('close');await command('next');await user(guest);
 const dto=await snapshot();expect(JSON.stringify(dto)).not.toMatch(/Későbbi titkos kérdés|Második titkos bor/);
 const result=parseGameSnapshot(dto,game).results!;expect(result.wines).toHaveLength(1);expect(result.wines[0].questions?.[0].ownOptionId).toBe('a');
 await user(other);expect(parseGameSnapshot(await snapshot(),game).results?.wines[0].questions?.[0].ownOptionId).toBe('b');
});
