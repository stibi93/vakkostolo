import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { loadDatabase } from '../scripts/database-harness.mjs';
const db=new PGlite();
const host=randomUUID(),one=randomUUID(),two=randomUUID(),outsider=randomUUID();
let game:string,rounds:string[];
interface Own {price_bucket:number|null;price_huf:number|null;alcohol_tenths:number;liking:number;price_points:number|null;alcohol_points:number;total:number|null}
interface Results {scoring_version:number;final:boolean;revealed_count:number;max_points:number;
  wines:{id:string;name:string;photo_updated_at:string|null;response_count:number;average_liking:number|null;own:Own|null}[];
  leaderboard:{id:string;nickname:string;points:number;rank:number;answered:number;unscored:number}[]}
async function user(id:string,role='authenticated') {
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal','aal2',false)",[id]);await db.exec(`set role ${role}`);
}
async function results(id=game) {return (await db.query<{r:Results}>('select public.get_game_results($1) r',[id])).rows[0].r;}
async function act(action:string) {
  await user(host);const version=(await db.query<{v:number}>('select version v from public.games where id=$1',[game])).rows[0].v;
  await db.query('select public.control_tasting($1,$2,$3,$4)',[game,version,randomUUID(),action]);
}
async function rate(id:string,bucket:number,alcohol:number,liking=8,index=0) {
  await user(id);await db.query('select public.submit_rating($1,$2,$3,$4)',[rounds[index],bucket,alcohol,liking]);
}
beforeAll(async()=>{await loadDatabase(db);});
beforeEach(async()=>{
  await db.exec(`reset role; truncate storage.objects; truncate auth.users cascade;
    insert into auth.users(id,is_anonymous,raw_app_meta_data) values ('${host}',false,'{"vakkostolo_role":"superadmin"}'),('${one}',true,'{}'),('${two}',true,'{}'),('${outsider}',true,'{}');`);
  await user(host);
  game=(await db.query<{id:string}>(`select public.create_game(gen_random_uuid(),'Eredménypróba',120,1,
    '[{"name":"Első titkos bor","price_huf":5000,"alcohol_tenths":135},{"name":"Második titkos bor","price_huf":11000,"alcohol_tenths":120}]') id`)).rows[0].id;
  const token=(await db.query<{t:{token:string}}>('select public.issue_invite($1) t',[game])).rows[0].t.token;
  for(const [id,name] of [[one,'Anna'],[two,'Béla']]) {await user(id);await db.query('select public.join_game($1,$2)',[token,name]);}
  await user(host);rounds=(await db.query<{id:string}>('select id from public.rounds where game_id=$1 order by position',[game])).rows.map(r=>r.id);
  await db.query("insert into storage.objects(bucket_id,name) values('wine-photos',$1)",[`${game}/${rounds[0]}.jpg`]);
});
afterAll(async()=>{await db.close();});
it('indítás és lezárás sem közöl titkos eredményt, fotómetaadatot vagy pontot',async()=>{
  await act('start');await rate(one,5,135);await user(two);
  expect(await results()).toMatchObject({revealed_count:0,max_points:0,wines:[],leaderboard:[]});
  expect((await db.query('select name from storage.objects')).rows).toEqual([]);
  await act('close');await user(one);expect((await results()).wines).toEqual([]);
  const raw=(await db.query('select public.get_game_snapshot($1) s',[game])).rows;
  expect(JSON.stringify(raw)).not.toMatch(/Első titkos|photo_updated_at|results|price_points/);
});
it('felfedéskor saját tipp, pontos és részpont, közös átlag és ranglista; idegen válasz nincs',async()=>{
  await act('start');await rate(one,5,135,10);await rate(two,6,140,6);await act('close');await act('reveal');
  await user(one);const a=await results();
  expect(a.wines[0]).toMatchObject({name:'Első titkos bor',response_count:2,average_liking:8,own:{price_bucket:5,price_points:50,alcohol_points:50,total:100}});
  expect(a.wines[0].photo_updated_at).not.toBeNull();expect(a.wines).toHaveLength(1);
  expect(a.leaderboard.map(e=>[e.nickname,e.points,e.rank])).toEqual([['Anna',100,1],['Béla',67,2]]);
  expect(JSON.stringify(a)).not.toContain('Második titkos');
  expect((await db.query('select name from storage.objects')).rows).toHaveLength(1);
  await user(two);expect((await results()).wines[0].own).toMatchObject({price_bucket:6,total:67});
  await user(host);expect((await results()).wines[0].own).toBeNull();
  const snapshot=(await db.query<{s:{results:Results}}>('select public.get_game_snapshot($1) s',[game])).rows[0].s;
  expect(snapshot.results.wines[0].own).toBeNull();
});
it('hiányzó válasz 0 pont, nem nulla tetszés; holtverseny közös helyezés, ismétlés stabil',async()=>{
  await act('start');await rate(one,5,135,10);await act('close');await act('reveal');
  await act('next');await rate(two,8,120,4,1);await act('close');await act('reveal');await act('finish');
  await user(one);const a=await results();
  expect(a).toMatchObject({final:true,max_points:200,revealed_count:2});
  expect(a.wines.map(w=>w.average_liking)).toEqual([10,4]);
  expect(a.wines[1].own).toBeNull();expect(a.wines[1].photo_updated_at).toBeNull();
  expect(a.leaderboard.map(e=>[e.points,e.rank,e.answered])).toEqual([[100,1,1],[100,1,1]]);
  expect(await results()).toEqual(a);
});
it('nulla válasznál nincs mesterséges tetszésátlag; mindenki 0 ponttal holtversenyben',async()=>{
  await act('start');await act('close');await act('reveal');await user(one);
  const r=await results();expect(r.wines[0]).toMatchObject({response_count:0,average_liking:null,own:null});
  expect(r.leaderboard.map(e=>[e.points,e.rank])).toEqual([[0,1],[0,1]]);
});
it('árkategória-határok és alkohol részpontok szerveroldali kerekítése',async()=>{
  await db.exec('reset role');
  for(const [price,bucket] of [[1000,1],[1001,2],[2000,2],[2001,3],[10000,7],[10001,8]]) {
    const p=(await db.query<{total:number}>('select total from private.rating_points(2,$1,135,$2,null,135)',[price,bucket])).rows[0];expect(p.total).toBe(100);
  }
  expect((await db.query<{total:number}>('select total from private.rating_points(2,5000,135,8,null,165)')).rows[0].total).toBe(0);
  expect((await db.query<{total:number}>('select total from private.rating_points(2,5000,135,5,null,134)')).rows[0].total).toBe(98);
});
it('régi v1 forintos válasz az eredeti képlettel; hiányzó forintos tipp nem kap kitalált pontot',async()=>{
  await db.exec('reset role');await db.query('update public.games set scoring_version=1 where id=$1',[game]);
  await act('start');await rate(one,5,140);await rate(two,5,135);
  await db.exec('reset role');await db.query('update public.ratings set price_huf=6000,price_bucket=null where round_id=$1 and participant_id=(select id from public.participants where user_id=$2)',[rounds[0],one]);
  await act('close');await act('reveal');await user(one);
  const r=await results();expect(r.wines[0].own).toMatchObject({price_huf:6000,price_points:40,total:82});
  await user(two);expect((await results()).wines[0].own?.total).toBeNull();expect((await results()).leaderboard.find(e=>e.nickname==='Béla')?.unscored).toBe(1);
});
it('idegen játék és kijelentkezett hívó tiltott; belső pontozás nem hívható',async()=>{
  await user(outsider);await expect(results()).rejects.toThrow('GAME_NOT_FOUND');
  await expect(db.query('select * from private.rating_points(2,5000,135,5,null,135)')).rejects.toThrow(/permission denied/);
  await user('');await expect(results()).rejects.toThrow('AUTH_REQUIRED');
  await user('','anon');await expect(results()).rejects.toThrow(/permission denied/);
});
it('1, 1, 3 helyezés holtverseny után, változó tetszés sem bontja fel',async()=>{
  await user(host);const token=(await db.query<{t:{token:string}}>('select public.issue_invite($1) t',[game])).rows[0].t.token;
  await user(outsider);await db.query('select public.join_game($1,\'Csaba\')',[token]);
  await act('start');await rate(one,5,135,1);await rate(two,5,135,10);await act('close');await act('reveal');await user(one);
  expect((await results()).leaderboard.map(e=>[e.rank,e.points])).toEqual([[1,100],[1,100],[3,0]]);
});
