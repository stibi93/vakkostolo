import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { authSession, authUser } from '../fixtures/auth';
import { lobbyResponse } from './support/lobby';
const game = '10000000-0000-0000-0000-000000000001';
const round = (n: number) => `20000000-0000-0000-0000-${String(n).padStart(12,'0')}`;

test('borfotó: mentés, hibás csere, újratöltés, menetátrendezés és törlés', async ({page},info) => {
  test.setTimeout(60_000);
  const photo = await readFile('tests/fixtures/sample-wine.png');
  const stored = new Set<string>();
  let failUpload = false, version = 1;
  let steps = [1,2].map(n => ({id:round(n),kind:'wine',title:`Próbabor ${n}`,message:'',seconds:120,status:'pending',round_position:n,price_huf:4500,alcohol_tenths:130}));
  await page.addInitScript(s=>localStorage.setItem('sb-auth-auth-token',JSON.stringify(s)),authSession());
  await page.routeWebSocket('wss://auth.vakkostolo.test/**',ws=>ws.close());
  await page.route('https://auth.vakkostolo.test/**',async route=>{
    const path = new URL(route.request().url()).pathname;
    if(path==='/auth/v1/user') return route.fulfill({json:authUser});
    if(path==='/rest/v1/rpc/get_host_game') return route.fulfill({json:{id:game,title:'Fotós menet',status:'draft',round_seconds:120,reveal_every:2,created_at:new Date().toISOString(),
      wines:steps.map((s,i)=>({position:i+1,round_id:s.id,name:s.title,price_huf:s.price_huf,alcohol_tenths:s.alcohol_tenths,photo_updated_at:stored.has(s.id)?'2026-09-24T10:00:00Z':null,photo_locked:false}))}});
    if(path==='/rest/v1/rpc/get_game_snapshot') return route.fulfill({json:{...lobbyResponse(game),game:{id:game,title:'Fotós menet',status:'draft',version},round:null,own_rating:null}});
    if(path==='/rest/v1/rpc/get_tasting_schedule') return route.fulfill({json:{version,status:'draft',reveal_every:2,steps}});
    if(path==='/rest/v1/rpc/save_tasting_schedule') {steps=route.request().postDataJSON().p_steps;version++;return route.fulfill({json:game});}
    const id = path.split('/').pop()?.replace('.jpg','') ?? '';
    if(path.startsWith('/storage/v1/object/sign/')) return route.fulfill({json:{signedURL:`/object/sign/wine-photos/${game}/${id}.jpg?token=fixture`}});
    if(path.startsWith('/storage/v1/object/wine-photos/') && route.request().method()==='POST') {
      if(failUpload) return route.fulfill({status:503,json:{message:'unavailable'}});
      stored.add(id);return route.fulfill({json:{Key:`wine-photos/${game}/${id}.jpg`}});
    }
    if(path==='/storage/v1/object/wine-photos' && route.request().method()==='DELETE') {
      for(const prefix of route.request().postDataJSON().prefixes) stored.delete(prefix.split('/').pop().replace('.jpg',''));
      return route.fulfill({json:route.request().postDataJSON().prefixes.map((name:string)=>({name}))});
    }
    await route.abort(); throw new Error(`Unexpected photo endpoint: ${path}`);
  });
  await page.route('https://auth.vakkostolo.test/storage/v1/object/sign/wine-photos/**?token=fixture',route=>route.fulfill({body:photo,contentType:'image/png'}));
  await page.goto(`/host/${game}`);
  const first = page.locator('.saved-wine-list > li').filter({has:page.getByRole('heading',{name:'1. Próbabor 1',exact:true})});
  await first.getByLabel('Fotó hozzáadása',{exact:false}).setInputFiles({name:'bor.jpg',mimeType:'image/png',buffer:photo});
  await expect(first.getByText('Fotó mentve.',{exact:false})).toBeVisible();
  await expect(first.getByRole('img',{name:'Próbabor 1 – borfotó'})).toBeVisible();
  await first.getByLabel('Fotó cseréje',{exact:false}).setInputFiles({name:'hibas.txt',mimeType:'text/plain',buffer:Buffer.from('hibás')});
  await expect(first.getByText('Képfájlt válassz',{exact:false})).toBeVisible();
  await expect(first.getByRole('img')).toBeVisible();
  failUpload=true;
  await first.getByLabel('Fotó cseréje',{exact:false}).setInputFiles({name:'csere.jpg',mimeType:'image/png',buffer:photo});
  await expect(first.getByText('A fotó mentését a szerver nem igazolta vissza.',{exact:false})).toBeVisible();
  await expect(first.getByRole('img')).toBeVisible();
  failUpload=false;
  await page.reload(); await expect(first.getByRole('img')).toBeVisible();
  await page.getByRole('button',{name:'Menet szerkesztése'}).click();
  await page.getByRole('button',{name:'2. lépés előrébb',exact:true}).click();
  await page.getByRole('button',{name:'Menet mentése',exact:true}).click();
  const moved = page.locator('.saved-wine-list > li').filter({has:page.getByRole('heading',{name:'2. Próbabor 1',exact:true})});
  await expect(moved.getByRole('img',{name:'Próbabor 1 – borfotó'})).toBeVisible();
  await expect(page.locator('.saved-wine-list > li').first().getByRole('img')).toHaveCount(0);
  expect(await moved.getByRole('img').evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true);
  await page.screenshot({path:info.outputPath('photos-and-schedule.png'),fullPage:true});
  await moved.getByRole('button',{name:'Fotó törlése',exact:false}).focus();await page.keyboard.press('Enter');
  await expect(moved.getByText('Fotó törölve.')).toBeVisible();
  await page.reload();await expect(page.locator('.saved-wine-list').getByRole('img')).toHaveCount(0);
  expect(stored.size).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('játékos csak a szerver által felfedett borhoz kér és lát fotót', async ({page},info) => {
  const photo=await readFile('tests/fixtures/sample-wine.png');
  const member='30000000-0000-0000-0000-000000000001';
  const user={...authUser,id:member,is_anonymous:true};
  let revealed=false, signedRequests=0;
  await page.addInitScript(s=>localStorage.setItem('sb-auth-auth-token',JSON.stringify(s)),authSession(user));
  await page.routeWebSocket('wss://auth.vakkostolo.test/**',ws=>ws.close());
  await page.route('https://auth.vakkostolo.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/auth/v1/user') return route.fulfill({json:user});
    if(path==='/rest/v1/rpc/get_game_snapshot') return route.fulfill({json:{
      ...lobbyResponse(game,[{id:member,nickname:'Vendég',seat:1,joined_at:new Date().toISOString()}],'player',member),
      game:{id:game,title:'Fotós menet',status:revealed?'reveal':'lobby',version:revealed?2:1},round:null,own_rating:null,
      ...(revealed?{revealed:[{id:round(1),position:1,name:'Felfedett bor',price_huf:4500,alcohol_tenths:130}]}:{})}});
    if(path.startsWith('/storage/v1/object/sign/')) {
      expect(revealed).toBe(true); signedRequests++;
      return route.fulfill({json:{signedURL:`/object/sign/wine-photos/${game}/${round(1)}.jpg?token=fixture`}});
    }
    if(path==='/rest/v1/rpc/resume_membership') return route.fulfill({json:{
      game_id:game,participant_id:member,nickname:'Vendég',title:'Fotós menet',status:'lobby',reclaim_saved:true}});
    await route.abort();throw new Error(`Unexpected player endpoint: ${path}`);
  });
  await page.route('https://auth.vakkostolo.test/storage/v1/object/sign/wine-photos/**?token=fixture',route=>route.fulfill({body:photo,contentType:'image/png'}));
  await page.goto(`/play/${game}`);
  await expect(page.getByRole('heading',{name:'Fotós menet'})).toBeVisible();
  await expect(page.getByRole('img')).toHaveCount(0);expect(signedRequests).toBe(0);
  revealed=true;await page.reload();
  const image=page.getByRole('img',{name:'Felfedett bor – borfotó'});
  await expect(image).toBeVisible();
  expect(await image.evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true);
  expect(signedRequests).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('revealed-photo.png'),fullPage:true});
});
