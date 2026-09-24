import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { authSession, authUser } from '../fixtures/auth';
import { lobbyResponse, realtimeHub } from './support/lobby';
const game='10000000-0000-0000-0000-000000000001';
const first='20000000-0000-0000-0000-000000000001', second='20000000-0000-0000-0000-000000000002';
const member=(i:number)=>`30000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
const participants=Array.from({length:10},(_,i)=>({id:member(i+1),nickname:i===0?'Anna':`Vendég ${i+1}`,seat:i+1,joined_at:'2026-09-24T10:00:00Z'}));
function fixture(revealed=true) {
  const hub=realtimeHub();const state={questions:false,revealed,finished:false,failPhoto:false,photoReads:0,card:null as null | {id:string;title:string;message:string;round_ids:string[]}};
  const publicWines=[{id:first,position:1,name:'Dűlőválogatás Furmint 2024',price_huf:5000,price_bucket:5,alcohol_tenths:135,photo_updated_at:'2026-09-24T10:00:00Z',response_count:2,average_liking:8},
    {id:second,position:2,name:'Kékfrankos 2023',price_huf:7500,price_bucket:6,alcohol_tenths:125,photo_updated_at:null,response_count:0,average_liking:null}];
  return {state,hub,async attach(page:Page,host=false) {
    const user=host?authUser:{...authUser,id:member(1),is_anonymous:true,email:undefined};
    await page.addInitScript(session=>localStorage.setItem('sb-auth-auth-token',JSON.stringify(session)),authSession(user));
    await hub.attach(page);
    await page.route('https://auth.vakkostolo.test/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/auth/v1/user')return route.fulfill({json:user});
      if(path==='/rest/v1/rpc/get_host_game') return route.fulfill({json:{id:game,title:'Őszi kóstoló',status:state.finished?'finished':'reveal',round_seconds:120,reveal_every:2,created_at:'2026-09-24T10:00:00Z',
        wines:publicWines.map(w=>({position:w.position,round_id:w.id,name:w.name,price_huf:w.price_huf,alcohol_tenths:w.alcohol_tenths,photo_updated_at:null,photo_locked:true}))}});
      if(path==='/rest/v1/rpc/list_host_games')return route.fulfill({json:[{id:game,title:'Őszi kóstoló',status:state.finished?'finished':'reveal',round_seconds:120,reveal_every:2,created_at:'2026-09-24T10:00:00Z'}]});
      if(path==='/rest/v1/rpc/get_game_snapshot')return route.fulfill({json:{
        ...lobbyResponse(game,participants,host?'host':'player',host?null:member(1)),
        game:{id:game,title:'Őszi kóstoló',status:state.revealed?(state.finished?'finished':'reveal'):'tasting',version:state.revealed?4:2},
        round:state.card ? null : {id:second,position:2,status:state.revealed?'revealed':'open',opened_at:new Date(Date.now()-30000).toISOString(),closes_at:new Date(Date.now()+60000).toISOString(),eligible:!host,can_submit:!host&&!state.revealed},own_rating:null,
        ...(state.card ? {reveal_card:state.card} : {}),
        ...(state.revealed?{revealed:publicWines,results:{scoring_version:2,final:state.finished,revealed_count:2,max_points:200,
          wines:publicWines.map((w,i)=>({...w,...(state.questions?{questions:[{id:'grape',prompt:'Melyik szőlőfajta?',options:[{id:'a',label:'Furmint'},{id:'b',label:'Olaszrizling'}],correctOptionId:'a',ownOptionId:host?null:'b'}]}:{}),own:host||i===1?null:{price_bucket:6,price_huf:null,alcohol_tenths:140,liking:8,price_points:25,alcohol_points:41.6666666666667,total:67}})),
          leaderboard:participants.map((p,i)=>({id:p.id,nickname:p.nickname,seat:p.seat,rank:i<2?1:3,points:i<2?67:0,answered:i<2?1:0,unscored:0}))}}:{})
      }});
      if(path===`/storage/v1/object/wine-photos/${game}/${first}.jpg`) {
        state.photoReads++; if(state.failPhoto)return route.fulfill({status:503,json:{message:'unavailable'}});
        return route.fulfill({contentType:'image/png',body:await readFile('public/demo/sample-wine-01.png')});
      }
      return route.abort();
    });
  }};
}
test('játékos: csak felfedés után fotó, saját összevetés, részpont, hiányzó tipp és ranglista',async({page},info)=>{
  const f=fixture(false);await f.attach(page);await page.goto(`/play/${game}`);
  await expect(page.getByRole('heading',{name:'02. tétel'})).toBeVisible();expect(f.state.photoReads).toBe(0);
  await expect(page.getByText('Dűlőválogatás Furmint 2024')).toHaveCount(0);
  f.state.revealed=true;f.hub.change(game,'games');
  await expect(page.getByRole('heading',{name:'Eddigi eredmények'})).toBeVisible();
  await expect(page.getByText('Ehhez a borhoz nincs leadott tipped.',{exact:false})).toBeVisible();
  await expect(page.getByText('Ehhez a borhoz nincs fotó.')).toBeVisible();
  await page.getByRole('button',{name:'Előző bor',exact:true}).focus();await page.keyboard.press('Enter');
  const photo=page.getByRole('img',{name:'Dűlőválogatás Furmint 2024 – a borhoz feltöltött fotó'});
  await expect(photo).toBeVisible();await expect.poll(()=>photo.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText('67 / 100 pont')).toBeVisible();
  const comparison=page.getByRole('region',{name:'Saját tipp és valódi érték'});
  await expect(comparison).toContainText('6 001–8 000 Ft');await expect(comparison).toContainText('4 001–6 000 Ft');
  await expect(comparison).toContainText('14% vol');await expect(comparison).toContainText('13,5% vol');
  await page.getByRole('region',{name:'Kóstoló eredményei'}).screenshot({path:info.outputPath('player-results.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Ranglista',exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'Anna · Te'})).toContainText('67');
  await page.reload();await expect(page.getByRole('heading',{name:'Eddigi eredmények'})).toBeVisible();
});
test('kivetítő: fotós borlap és lapozható ranglista, saját válaszok és meghívó nélkül is',async({page},info)=>{
  const f=fixture();f.state.finished=true;await f.attach(page,true);await page.goto(`/present/${game}`);
  await expect(page.getByRole('heading',{name:'A kóstoló eredménye'})).toBeVisible();
  await expect(page.getByText('nincs érvényes meghívó',{exact:false})).toHaveCount(0);
  await page.getByLabel('Felfedett bor',{exact:true}).selectOption(first);
  const photo=page.getByRole('img',{name:/Dűlőválogatás Furmint/});await expect(photo).toBeVisible();
  await expect.poll(()=>photo.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('region',{name:'Saját tipp és valódi érték'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Kóstoló befejezése'})).toHaveCount(0);
  if(info.project.name.includes('desktop')) await expect(page.getByRole('article',{name:'1. bor eredménye'})).toBeInViewport({ratio:1});
  await page.screenshot({path:info.outputPath('projector-wine.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Ranglista',exact:true}).click();
  await expect(page.getByRole('row')).toHaveCount(6);
  if(info.project.name.includes('desktop')) await expect(page.getByRole('button',{name:'Következő oldal'})).toBeInViewport({ratio:1});
  await page.screenshot({path:info.outputPath('projector-ranking.png'),fullPage:true});
  await page.getByRole('button',{name:'Következő oldal'}).click();await expect(page.getByRole('row')).toHaveCount(6);
  await expect(page.getByRole('row').filter({hasText:'Vendég 10'})).toBeVisible();
});
test('képhiba után az adatok megmaradnak, a fotó újrapróbálható',async({page})=>{
  const f=fixture();f.state.failPhoto=true;await f.attach(page);await page.goto(`/play/${game}`);
  await page.getByLabel('Felfedett bor',{exact:true}).selectOption(first);
  await expect(page.getByText('A fotó most nem tölthető be.')).toBeVisible();
  await expect(page.getByText('67 / 100 pont')).toBeVisible();f.state.failPhoto=false;
  await page.getByRole('button',{name:'Fotó újratöltése'}).click();
  await expect(page.getByRole('img',{name:/Dűlőválogatás Furmint/})).toBeVisible();
});

test('befejezett kóstoló hostoldaláról is megnyitható a prezentáció',async({page})=>{
  const f=fixture();f.state.finished=true;await f.attach(page,true);await page.goto(`/host/${game}`);
  const link=page.getByRole('link',{name:'Eredmények kivetítése'});
  await expect(link).toBeVisible();await expect(link).toHaveAttribute('href',`/present/${game}`);
  await expect(link).toHaveAttribute('target','_blank');
});

for (const host of [false,true]) test(`felfedési kártya kiválasztott borai a ${host?'kivetítőn':'játékosnál'}`,async({page},info)=>{
  const f=fixture();f.state.card={id:member(20),title:'Illatok összehasonlítása',message:'Kezdjük a furminttal.',round_ids:[first]};
  await f.attach(page,host);await page.goto(`/${host?'present':'play'}/${game}`);
  await expect(page.getByRole('heading',{name:'Illatok összehasonlítása'})).toBeVisible();
  await expect(page.getByLabel('Felfedett bor',{exact:true})).toHaveValue(first);
  await expect(page.getByRole('button',{name:'Következő bor',exact:true})).toBeDisabled();
  await expect(page.getByRole('heading',{name:'Kékfrankos 2023'})).toHaveCount(0);
  if(host && info.project.name.includes('desktop')) await expect(page.getByRole('article',{name:'1. bor eredménye'})).toBeInViewport({ratio:1});
  await page.screenshot({path:info.outputPath('single-reveal-card.png'),fullPage:true});
  f.state.card={id:member(21),title:'Közös összevetés',message:'Most mindkét bort bemutatjuk.',round_ids:[second,first]};
  f.hub.change(game,'games');
  await expect(page.getByRole('heading',{name:'Közös összevetés'})).toBeVisible();
  await expect(page.getByLabel('Felfedett bor',{exact:true})).toHaveValue(second);
  await page.getByRole('button',{name:'Következő bor',exact:true}).click();
  await expect(page.getByLabel('Felfedett bor',{exact:true})).toHaveValue(first);
  await page.reload();
  await expect(page.getByLabel('Felfedett bor',{exact:true})).toHaveValue(second);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('egyedi kérdések felfedésnél: saját tipp és helyes válasz',async({page},info)=>{
 const f=fixture();f.state.questions=true;await f.attach(page);await page.goto(`/play/${game}`);
 const result=page.getByRole('region',{name:'Egyedi kérdések eredménye'});
 await expect(result).toContainText('Helyes válasz: Furmint');await expect(result).toContainText('A tipped: Olaszrizling');await expect(result).toContainText('Nem talált');
 await result.screenshot({path:info.outputPath('question-result.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('egyedi kérdések kivetítőn: helyes válasz saját tipp nélkül',async({page},info)=>{
 const f=fixture();f.state.questions=true;await f.attach(page,true);await page.goto(`/present/${game}`);
 const result=page.getByRole('region',{name:'Egyedi kérdések eredménye'});await expect(result).toContainText('Helyes válasz: Furmint');
 await expect(result).not.toContainText('A tipped:');await page.screenshot({path:info.outputPath('question-projector.png'),fullPage:true});
});
