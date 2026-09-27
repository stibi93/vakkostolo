import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { authSession, authUser } from '../fixtures/auth';
import { lobbyResponse, realtimeHub } from './support/lobby';
import type { ScheduleStep } from '../../src/schedule/model';
const game = '10000000-0000-0000-0000-000000000001';
const wine = '20000000-0000-0000-0000-000000000001';
const second = '20000000-0000-0000-0000-000000000002';
const member = '30000000-0000-0000-0000-000000000001';
function fixture(active = false) {
  const hub = realtimeHub();
  const state = { version: 1, status: active ? 'tasting' : 'lobby', opened: Date.now(), deadline: (Date.now()+120000) as number | null,
    conflict: false, saves: 0, controls: [] as string[], pause: false,
    steps: [wine,second].map((id,i): ScheduleStep => ({ id, kind:'wine', title: `Titkos bor ${i+1}`, message:'', seconds:120,
      status:active && i===0 ? 'open' : 'pending', price_huf:4500, alcohol_tenths:130, round_position:i+1 })) };
  return { state, hub, async attach(page: Page, player = false) {
    const user = player ? { ...authUser, id:member, is_anonymous:true, email:undefined } : authUser;
    await page.addInitScript(session => localStorage.setItem('sb-auth-auth-token',JSON.stringify(session)),authSession(user));
    await hub.attach(page);
    await page.route('https://auth.vakkostolo.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/auth/v1/user') return route.fulfill({json:user});
      if (path === '/rest/v1/rpc/get_host_game') return route.fulfill({json:{id:game,title:'Őszi menet',status:state.status,
        schedule:{version:state.version,status:state.status,reveal_every:2,steps:state.steps},round_seconds:120,reveal_every:2,created_at:new Date().toISOString(),wines:state.steps.filter(s=>s.kind==='wine').map((s,i)=>({round_id:s.id,photo_updated_at:null,photo_locked:s.status==='revealed',position:i+1,name:s.title,price_huf:s.price_huf,alcohol_tenths:s.alcohol_tenths}))}});
      if (path === '/rest/v1/rpc/get_game_snapshot') return route.fulfill({json:{
        ...lobbyResponse(game,[{id:member,nickname:'Anna',seat:1,joined_at:new Date(Date.now()-60000).toISOString()}],player?'player':'host',player?member:null),
        game:{id:game,title:'Őszi menet',status:state.status,version:state.version},server_now:new Date().toISOString(),own_rating:null,
        round:active && !state.pause ? {id:wine,position:1,status:state.steps[0].status,opened_at:new Date(state.opened).toISOString(),
          closes_at:state.deadline === null ? null : new Date(state.deadline).toISOString(),eligible:player,can_submit:player && state.steps[0].status==='open'} : null,
        ...(state.pause ? {break:{id:second,title:'Víz és kenyér',message:'Pihenjünk egyet.\nA következő tételt együtt kezdjük.',ends_at:new Date(Date.now()+300000).toISOString()}} : {})
      }});
      if (path === '/rest/v1/rpc/get_tasting_schedule') return route.fulfill({json:{version:state.version,status:state.status,reveal_every:2,steps:state.steps}});
      if (path === '/rest/v1/rpc/save_tasting_schedule') {
        state.saves++;
        if (state.conflict) return route.fulfill({status:400,json:{message:'VERSION_CONFLICT'}});
        const input=route.request().postDataJSON();
        state.steps=[...state.steps.filter(s=>s.status!=='pending'),...input.p_steps];
        let index=0; state.steps=state.steps.map(s=>({...s,round_position:s.kind==='wine'?++index:null})); state.version++;
        hub.change(game,'games'); return route.fulfill({json:game});
      }
      if (path === '/rest/v1/rpc/control_tasting') {
        const input=route.request().postDataJSON(); state.controls.push(input.p_action); state.version++;
        if(input.p_action==='time') state.deadline=input.p_seconds === 0 ? null : Date.now()+input.p_seconds*1000;
        if(input.p_action==='close') {state.steps[0].status='closed';state.status='intermission';}
        if(input.p_action==='next') {state.pause=true;state.status='intermission';}
        hub.change(game,'games'); hub.change(game,'rounds'); return route.fulfill({json:game});
      }
      return route.abort();
    });
  }};
}
test('mentett menet: egyedi szünet, sorrend, új bor, törlés és konfliktus',async({page},info)=>{
  const f=fixture(); await f.attach(page); await page.goto(`/host/${game}`);
  await page.getByRole('button',{name:'Menet szerkesztése'}).click();
  const editor=page.getByRole('region',{name:'Borok és szünetek'});
  await editor.getByRole('button',{name:'Szünet hozzáadása'}).click();
  await editor.getByLabel('Átvezető képernyő címe').fill('Víz és kenyér');
  await editor.getByLabel('Játékosoknak megjelenő szöveg').fill('Pihenjünk egyet.\nA következő tételt együtt kezdjük.');
  await editor.getByRole('button',{name:'3. lépés előrébb',exact:true}).focus(); await page.keyboard.press('Enter');
  await editor.getByRole('button',{name:'Bor hozzáadása',exact:true}).click();
  await editor.getByLabel('Bor neve és évjárata').last().fill('Új tétel 2024');
  await editor.getByRole('button', { name: 'Összes becsukása' }).click();
  await expect(editor.getByLabel('Bor neve és évjárata').last()).toBeHidden();
  await expect(editor.getByText('Új tétel 2024')).toBeVisible();
  await editor.getByRole('button', { name: 'Kinyitás · 1. lépés' }).click();
  await expect(editor.getByLabel('Bor neve és évjárata').first()).toBeVisible();
  await editor.getByRole('button', { name: 'Összes kinyitása' }).click();
  await editor.getByRole('button',{name:'3. lépés eltávolítása',exact:true}).click();
  f.state.conflict=true; await editor.getByRole('button',{name:'Menet mentése',exact:true}).click();
  await expect(editor.getByRole('alert')).toContainText('piszkozatod megmaradt');
  await expect(editor.getByLabel('Átvezető képernyő címe')).toHaveValue('Víz és kenyér');
  f.state.conflict=false; await editor.getByRole('button',{name:'Menet mentése',exact:true}).click();
  await expect(editor.getByRole('status')).toHaveText('A menet mentve.');
  expect(f.state.steps.map(s=>s.kind)).toEqual(['wine','break','wine']);
  expect(f.state.steps[2].title).toBe('Új tétel 2024');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await editor.screenshot({path:info.outputPath('schedule-editor.png')});
  await page.reload();
  await expect(page.getByRole('list',{name:'Mentett kóstolómenet'})).toContainText('Víz és kenyér');
  await page.getByRole('button',{name:'Menet szerkesztése'}).click();
  await expect(page.getByLabel('Átvezető képernyő címe')).toHaveValue('Víz és kenyér');
  for (let i = 0; i < 6; i++) await editor.getByRole('button', { name: 'Bor hozzáadása', exact: true }).click();
  await editor.locator('.schedule-step').last().scrollIntoViewIfNeeded();
  await expect.poll(async () => (await editor.locator('.schedule-add-bar').boundingBox())?.y ?? 999).toBeLessThan(24);
});
test('élő időállítás megőrzi a játékos piszkozatát, lezárás után egyedi átvezetés',async({page,browser},info)=>{
  const f=fixture(true);await f.attach(page); await page.goto(`/host/${game}`);
  const context=await browser.newContext({...info.project.use});
  try {
    const player=await context.newPage();await f.attach(player,true);await player.goto(`/play/${game}`);
    await player.getByRole('radio',{name:'4 001–6 000 Ft',exact:true}).check();
    await player.getByLabel('Becsült alkoholfok (% vol)').fill('13,5');
    await page.getByRole('button',{name:'Időkorlát kikapcsolása'}).click();
    await expect(player.getByRole('timer',{name:'Hátralévő idő',exact:true})).toHaveCount(0);
    await expect(player.getByText('Időkorlát nélkül',{exact:true})).toBeVisible();
    await expect(player.getByRole('radio',{name:'4 001–6 000 Ft',exact:true})).toBeChecked();
    await expect(player.getByLabel('Becsült alkoholfok (% vol)')).toHaveValue('13,5');
    await expect(player.getByRole('button',{name:'Tipp beküldése'})).toBeEnabled();
    await expect(player.locator('.rating-category-icon')).toHaveCount(3);
    await expect(player.locator('.rating-liking span').first()).toHaveText('1');
    await player.screenshot({path:info.outputPath('player-untimed.png'),fullPage:true});
    await page.getByLabel('Hátralévő idő mostantól (másodperc)').fill('300');
    await page.getByRole('button',{name:'Időkorlát bekapcsolása'}).click();
    await expect(player.getByRole('timer',{name:'Hátralévő idő',exact:true})).toHaveText(/0[45]:[0-5][0-9]/);
    await expect(player.getByRole('radio',{name:'4 001–6 000 Ft',exact:true})).toBeChecked();
    await expect(player.getByLabel('Becsült alkoholfok (% vol)')).toHaveValue('13,5');
    await player.getByRole('button',{name:'Tipp beküldése'}).scrollIntoViewIfNeeded();
    await expect(player.getByRole('timer',{name:'Hátralévő idő',exact:true})).toBeInViewport();
    await player.screenshot({path:info.outputPath('player-sticky-clock.png')});
    await page.getByRole('button',{name:'Kör lezárása most'}).click();
    await expect(player.getByRole('button',{name:'Tipp beküldése'})).toBeDisabled();
    await expect(player.getByRole('timer',{name:'Hátralévő idő',exact:true})).toHaveText('00:00');
    await page.getByRole('button',{name:'Következő lépés indítása'}).click();
    await expect(player.getByRole('heading',{name:'Víz és kenyér'})).toBeVisible();
    await expect(player.getByText('A következő tételt együtt kezdjük.',{exact:false})).toBeVisible();
    await expect(player.getByText('Titkos bor',{exact:false})).toHaveCount(0);
    expect(await player.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await player.screenshot({path:info.outputPath('player-break.png'),fullPage:true});
  } finally {await context.close();}
});

test('boronként menthető az időkorlát kikapcsolása',async({page})=>{
  const f=fixture();await f.attach(page);await page.goto(`/host/${game}`);
  await page.getByRole('button',{name:'Menet szerkesztése'}).click();
  await page.getByRole('checkbox',{name:'Időkorlát használata'}).first().uncheck();
  await page.getByRole('button',{name:'Menet mentése',exact:true}).click();
  await expect(page.getByText('A menet mentve.',{exact:true})).toBeVisible();
  expect(f.state.steps[0].seconds).toBe(0);expect(f.state.steps[1].seconds).toBe(120);
  await page.reload();await page.getByRole('button',{name:'Menet szerkesztése'}).click();
  await expect(page.getByRole('checkbox',{name:'Időkorlát használata'}).first()).not.toBeChecked();
});

test('egy- és többboros felfedési kártya menthető, bezárva és újratöltve is látszik',async({page},info)=>{
  const f=fixture();await f.attach(page);await page.goto(`/host/${game}`);
  await page.getByRole('button',{name:'Menet szerkesztése'}).click();
  await page.getByRole('button',{name:'Felfedés hozzáadása'}).click();
  await page.getByLabel('Felfedés címe').fill('Két bor összehasonlítása');
  await page.getByLabel('Játékosoknak megjelenő szöveg').fill('Miben különbözik az illatuk?');
  await page.getByRole('checkbox',{name:'Titkos bor 1',exact:true}).check();
  await page.getByRole('checkbox',{name:'Titkos bor 2',exact:true}).check();
  await page.getByRole('button',{name:'Felfedés hozzáadása'}).click();
  await page.getByLabel('Felfedés címe').last().fill('Második bor újra');
  await page.getByRole('checkbox',{name:'Titkos bor 2',exact:true}).last().check();
  await page.getByRole('region',{name:'Borok és szünetek'}).screenshot({path:info.outputPath('reveal-card-editor.png')});
  await page.getByRole('button',{name:'Menet mentése',exact:true}).click();
  await expect(page.getByRole('button',{name:'Menet szerkesztése'})).toBeVisible();
  expect(f.state.steps[2].reveal_round_ids).toEqual([wine,second]);
  expect(f.state.steps[3].reveal_round_ids).toEqual([second]);
  await page.reload();
  const overview=page.getByRole('list',{name:'Mentett kóstolómenet'});
  await expect(overview).toContainText('Két bor összehasonlítása');
  await expect(overview).toContainText('Miben különbözik az illatuk?');
  await overview.screenshot({path:info.outputPath('reveal-card-overview.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Menet szerkesztése'}).click();
  await page.getByLabel('Felfedés címe').first().fill('Elvetett cím');
  await page.getByRole('button',{name:'Módosítások elvetése és bezárás'}).click();
  await expect(overview).toContainText('Két bor összehasonlítása');
  await expect(overview).not.toContainText('Elvetett cím');
});

test('a kártyagombok közvetlenül a mentett kóstoló tetején elérhetők',async({page},info)=>{
  const f=fixture();await f.attach(page);await page.goto(`/host/${game}`);
  await expect(page.getByRole('button',{name:'Szünet hozzáadása',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Felfedés hozzáadása',exact:true})).toBeVisible();
  await page.getByRole('region',{name:'Borok és szünetek'}).screenshot({path:info.outputPath('visible-card-actions.png')});
  await page.getByRole('button',{name:'Szünet hozzáadása',exact:true}).click();
  await expect(page.getByLabel('Átvezető képernyő címe')).toHaveValue('Szünet');
  await page.getByRole('button',{name:'Menet mentése',exact:true}).click();
  await page.getByRole('button',{name:'Felfedés hozzáadása',exact:true}).click();
  await page.getByRole('checkbox',{name:'Titkos bor 1',exact:true}).check();
  await page.getByRole('button',{name:'Menet mentése',exact:true}).click();
  await expect(page.getByRole('list',{name:'Mentett kóstolómenet'})).toContainText('Felfedés');
  expect(f.state.steps.map(s=>s.kind)).toEqual(['wine','wine','break','reveal']);
});

test('egyedi kérdések mentett bornál: szerkesztés, újratöltés és törlés',async({page},info)=>{
 const f=fixture();await f.attach(page);await page.goto(`/host/${game}`);await page.getByRole('button',{name:'Menet szerkesztése'}).click();
 await page.getByRole('button',{name:'Országkérdés'}).first().click();await page.getByLabel('Helyes válasz (felfedésig titkos)').selectOption({label:'Magyarország'});
 await page.getByRole('button',{name:'Menet mentése',exact:true}).click();await expect(page.getByText('A menet mentve.',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Menet szerkesztése'}).click();await expect(page.getByLabel('Kérdés szövege')).toHaveValue('Melyik országból származik a bor?');
 await page.getByRole('region',{name:'Egyedi kérdések',exact:true}).first().screenshot({path:info.outputPath('saved-question-editor.png')});
 await page.getByRole('button',{name:'Kérdés törlése',exact:true}).click();await page.getByRole('button',{name:'Menet mentése',exact:true}).click();await expect(page.getByText('A menet mentve.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Menet szerkesztése'}).click();await expect(page.getByLabel('Kérdés szövege')).toHaveCount(0);
});
