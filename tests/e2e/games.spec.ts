import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { lobbyResponse } from './support/lobby';
import { authSession, authUser } from '../fixtures/auth';

const gameId = '10000000-0000-0000-0000-000000000001';
const privateGameId = '10000000-0000-0000-0000-000000000002';
interface StoredGame {
  id: string; title: string; status: string; round_seconds: number; reveal_every: number; created_at: string;
  wines: { name: string; price_huf: number; alcohol_tenths: number; position: number }[];
}
interface CreatePayload {
  p_request_id: string; p_title: string; p_round_seconds: number; p_reveal_every: number;
  p_steps?: {kind:string;wine_index?:number;wine_indexes?:number[];title?:string;message?:string;seconds?:number}[];
  p_wines: { questions?: {correctOptionId:string;options:{id:string;label:string}[]}[]; name: string; price_huf: number; alcohol_tenths: number }[];
}
async function setup(page: Page) {
  await page.routeWebSocket('wss://auth.vakkostolo.test/**', (ws) => ws.close());
  await page.addInitScript((session) => {
    if (!sessionStorage.getItem('fixture-ready')) {
      localStorage.setItem('sb-auth-auth-token', JSON.stringify(session));
      sessionStorage.setItem('fixture-ready', 'true');
    }
  }, authSession());
  const state = { game: null as StoredGame | null, calls: [] as CreatePayload[], loseFirstResponse: false,
    malformed: false, failList: false, failDelete: false, deletes: 0 };
  await page.route('https://auth.vakkostolo.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: authUser });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname === '/rest/v1/rpc/list_host_games') {
      if (state.failList) return route.fulfill({ status: 503, json: { message: 'fixture unavailable' } });
      return route.fulfill({ json: state.game ? [state.game] : [] });
    }
    if (url.pathname === '/rest/v1/rpc/delete_game') {
      state.deletes++;
      if (state.failDelete) return route.fulfill({status:503,json:{message:'unavailable'}});
      if (route.request().postDataJSON().p_finalize) state.game=null;
      return route.fulfill({json:[]});
    }
    if (['/rest/v1/rpc/create_game','/rest/v1/rpc/create_game_with_schedule'].includes(url.pathname)) {
      const body = route.request().postDataJSON() as CreatePayload;
      state.calls.push(body);
      expect(body).not.toHaveProperty('host_id');
      expect(body).not.toHaveProperty('status');
      if (!state.game) state.game = { id: gameId, title: body.p_title, status: 'draft',
        round_seconds: body.p_round_seconds, reveal_every: body.p_reveal_every, created_at: new Date().toISOString(),
        wines: body.p_wines.map((wine, i) => ({ ...wine, position: i+1, round_id: `20000000-0000-0000-0000-${String(i+1).padStart(12, '0')}`, photo_updated_at: null, photo_locked: false })) };
      if (state.loseFirstResponse && state.calls.length === 1) return route.abort('failed');
      return route.fulfill({ json: gameId });
    }
    if (url.pathname === '/rest/v1/rpc/get_game_snapshot') {
      return route.fulfill({ json: { ...lobbyResponse(gameId), game: { id: gameId, title: state.game?.title, status: state.game?.status, version: 0 } } });
    }
    if (url.pathname === '/rest/v1/rpc/get_host_game') {
      const body = route.request().postDataJSON() as { p_game_id: string };
      if (!state.game || body.p_game_id !== state.game.id) return route.fulfill({ status: 400, json: { message: 'GAME_NOT_FOUND', code: 'P0001' } });
      return route.fulfill({ json: state.malformed ? { ...state.game, wines: null } : state.game });
    }
    if (url.pathname === '/rest/v1/rpc/resume_membership') {
      await route.fulfill({ json: { game_id: '10000000-0000-0000-0000-000000000001', participant_id: '30000000-0000-0000-0000-000000000001',
        nickname: 'Anna', title: 'Kóstoló', status: 'lobby', reclaim_saved: true } });
      return;
    }
    await route.abort();
    throw new Error(`Unexpected mocked endpoint: ${url.pathname}`);
  });
  return state;
}
async function fillWine(page: Page, position: number, name: string, price: string, alcohol: string) {
  const row = page.getByRole('group', { name: `${position}. tétel`, exact: true });
  await row.getByLabel('Bor neve és évjárata').fill(name);
  await row.getByLabel('Valódi palackár').fill(price);
  await row.getByLabel('Valódi alkoholfok').fill(alcohol);
}
async function fillGame(page: Page) {
  await page.goto('/host/new');
  await page.getByLabel('Kóstoló címe').fill('Őszi kóstoló');
  await fillWine(page, 1, 'Első mintabor 2024', '4500', '13,5');
}

test('létrehozás, sorrend, mentett részletek és újratöltés', async ({ page }, info) => {
  const state = await setup(page);
  await fillGame(page);
  await page.getByRole('button', { name: /Bor hozzáadása/ }).click();
  await fillWine(page, 2, 'Második mintabor 2023', '6900', '12.5');
  await page.getByRole('button', { name: '2. tétel előrébb' }).click();
  await page.getByRole('button', { name: /Bor hozzáadása/ }).click();
  await page.getByRole('button', { name: '3. tétel törlése' }).click();
  await page.screenshot({ path: info.outputPath('create-game.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Kóstoló létrehozása', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/host/${gameId}$`));
  await expect(page.getByRole('heading', { name: 'Őszi kóstoló' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '1. Második mintabor 2023' })).toBeVisible();
  expect(state.calls).toHaveLength(1);
  expect(state.calls[0].p_wines[0].alcohol_tenths).toBe(125);
  await page.screenshot({ path: info.outputPath('saved-game.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Őszi kóstoló' })).toBeVisible();
  await page.getByRole('link', { name: 'Saját kóstolóim', exact: true }).click();
  await page.getByRole('link', { name: 'Őszi kóstoló', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2. Első mintabor 2024' })).toBeVisible();
});

test('hibás bevitel nem küld kérést, a javított adat menthető', async ({ page }, info) => {
  const state = await setup(page);
  await fillGame(page);
  await page.getByRole('group', { name: '1. tétel', exact: true }).getByLabel('Valódi alkoholfok').fill('13,55');
  await page.getByRole('button', { name: 'Kóstoló létrehozása', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('legfeljebb egy tizedesjeggyel');
  await expect(page.getByRole('alert')).toBeFocused();
  expect(state.calls).toHaveLength(0);
  await page.screenshot({ path: info.outputPath('create-validation.png'), fullPage: true });
  await page.getByRole('group', { name: '1. tétel', exact: true }).getByLabel('Valódi alkoholfok').fill('13,5');
  await page.getByRole('button', { name: 'Kóstoló létrehozása', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Őszi kóstoló' })).toBeVisible();
});

test('elveszett válasz után ugyanaz a kérésazonosító és adat kerül újra beküldésre', async ({ page }, info) => {
  const state = await setup(page);
  state.loseFirstResponse = true;
  await fillGame(page);
  await page.getByRole('button', { name: 'Kóstoló létrehozása', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('nem igazolta');
  await expect(page.getByLabel('Kóstoló címe')).toHaveValue('Őszi kóstoló');
  await expect(page.getByText('A kóstoló létrejött.', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('create-network-error.png'), fullPage: true });
  await page.getByRole('button', { name: 'Kóstoló létrehozása', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Őszi kóstoló' })).toBeVisible();
  expect(state.calls).toHaveLength(2);
  expect(state.calls[0]).toEqual(state.calls[1]);
});

test('idegen kóstoló hibája és listahiba is javítható navigációt ad', async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/host/${privateGameId}`);
  await expect(page.getByRole('alert')).toContainText('nem te vagy a játékmestere');
  await expect(page.getByLabel('Kóstoló címe')).toHaveCount(0);
  state.failList = true;
  await page.getByRole('link', { name: 'Saját kóstolóim', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('nem igazolta');
  state.failList = false;
  await page.getByRole('button', { name: 'Lista frissítése' }).click();
  await expect(page.getByText('Még nincs mentett kóstolód.')).toBeVisible();
});

test('ablakváltás nem törli az űrlapot, kijelentkezés után a titkos adatok eltűnnek', async ({ page }) => {
  await setup(page);
  await fillGame(page);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Kóstoló címe')).toHaveValue('Őszi kóstoló');
  await page.getByRole('button', { name: 'Kijelentkezés', exact: true }).click();
  await expect(page.getByLabel('Felhasználónév')).toBeVisible();
  await expect(page.getByLabel('Bor neve és évjárata')).toHaveCount(0);
});

test('új kóstoló időkorlát nélkül is létrehozható',async({page})=>{
  const state=await setup(page);await fillGame(page);
  await page.getByRole('checkbox',{name:'Időkorlát használata'}).uncheck();
  await expect(page.getByLabel('Kóstolási idő boronként (másodperc)')).toHaveCount(0);
  await page.getByRole('button',{name:'Kóstoló létrehozása',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Őszi kóstoló'})).toBeVisible();
  expect(state.calls[0].p_round_seconds).toBe(0);
  await expect(page.getByText('Időkorlát nélkül',{exact:false})).toBeVisible();
});

test('kóstoló törlés: mégse, hiba, újrapróba és lista frissítése',async({page},info)=>{
  const state=await setup(page);
  state.game={id:gameId,title:'Törlendő próba',status:'draft',round_seconds:120,reveal_every:2,created_at:new Date().toISOString(),wines:[]};
  await page.goto('/host');
  await page.getByRole('button',{name:'Kóstoló törlése · Törlendő próba'}).click();
  await page.getByRole('button',{name:'Mégse',exact:true}).click();expect(state.deletes).toBe(0);
  await page.getByRole('button',{name:'Kóstoló törlése · Törlendő próba'}).click();
  state.failDelete=true;
  await page.getByRole('button',{name:'Végleges törlés',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('group',{name:'Kóstoló törlésének megerősítése: Törlendő próba'}).screenshot({path:info.outputPath('delete-confirm.png')});
  state.failDelete=false;
  await page.getByRole('button',{name:'Végleges törlés',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.getByText('A kóstoló törölve.',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Törlendő próba',exact:true})).toHaveCount(0);
  await page.reload();await expect(page.getByText('Még nincs mentett kóstolód.',{exact:true})).toBeVisible();
});

test('új kóstoló: szünet és többboros felfedés már az első mentés előtt',async({page},info)=>{
  const state=await setup(page);await fillGame(page);
  await expect(page.getByRole('button',{name:'Szünet hozzáadása',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Szünet hozzáadása',exact:true}).click();
  await page.getByLabel('Szünet címe').fill('Közös pihenő');
  await page.getByRole('button',{name:/Bor hozzáadása/}).click();
  await fillWine(page,2,'Második bor','5000','12');
  await page.getByRole('button',{name:'Felfedés hozzáadása',exact:true}).click();
  await page.getByLabel('Felfedés címe').fill('Két bor bemutatása');
  await page.getByRole('button',{name:'Kóstoló létrehozása',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('válassz legalább egy');
  expect(state.calls).toHaveLength(0);
  await page.getByRole('checkbox',{name:'1. Első mintabor 2024',exact:true}).check();
  await page.getByRole('checkbox',{name:'2. Második bor',exact:true}).check();
  await page.getByRole('region',{name:'Új kóstoló',exact:true}).screenshot({path:info.outputPath('create-full-schedule.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  state.loseFirstResponse=true;
  await page.getByRole('button',{name:'Kóstoló létrehozása',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button',{name:'Kóstoló létrehozása',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/host/${gameId}$`));
  expect(state.calls).toHaveLength(2);
  expect(state.calls[0]).toEqual(state.calls[1]);
  expect(state.calls[0].p_steps?.map(s=>s.kind)).toEqual(['wine','break','wine','reveal']);
  expect(state.calls[0].p_steps?.[3].wine_indexes).toEqual([0,1]);
});

test('egyedi kérdések új bornál: sablon, hibajavítás és mentett payload',async({page},info)=>{
 const state=await setup(page);await fillGame(page);
 await page.getByRole('button',{name:'Szőlőfajta-kérdés'}).focus();await page.keyboard.press('Enter');
 await page.getByRole('button',{name:'Kóstoló létrehozása',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('helyes választ');expect(state.calls).toHaveLength(0);
 await page.getByLabel('Helyes válasz (felfedésig titkos)').selectOption({label:'Furmint'});
 await page.getByRole('button',{name:'Országkérdés'}).click();
 await page.getByLabel('Helyes válasz (felfedésig titkos)').nth(1).selectOption({label:'Magyarország'});
 await page.getByRole('button',{name:'Saját kérdés',exact:true}).click();
 const custom=page.getByRole('group',{name:'3. kérdés',exact:true});
 await custom.getByLabel('Kérdés szövege').fill('Milyen hordóban érlelődött a bor?');
 await custom.getByLabel('1. válaszlehetőség',{exact:true}).fill('Tölgy');await custom.getByLabel('2. válaszlehetőség',{exact:true}).fill('Akác');
 await custom.getByLabel('Helyes válasz (felfedésig titkos)').selectOption({label:'Tölgy'});
 for(const fields of await page.locator('.question-fields').all()) {
   const add=await fields.getByRole('button',{name:'Válaszlehetőség hozzáadása',exact:true}).boundingBox();
   const label=await fields.locator('label').filter({has:page.locator('select')}).boundingBox();
   expect(label!.y-(add!.y+add!.height)).toBeGreaterThanOrEqual(19);
 }
 await page.getByRole('region',{name:'Egyedi kérdések',exact:true}).screenshot({path:info.outputPath('question-editor.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Kóstoló létrehozása',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/host/${gameId}$`));
 const questions=state.calls[0].p_wines[0].questions!;expect(questions).toHaveLength(3);
 expect(questions[0].correctOptionId).toBe(questions[0].options[0].id);expect(state.calls[0].p_steps).toEqual([{kind:'wine',wine_index:0}]);
});

test('meglévő kóstoló másolata kitölti az új űrlapot', async ({ page }) => {
  const state = await setup(page);
  await fillGame(page);
  await page.getByRole('button', { name: 'Kóstoló létrehozása', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/host/${gameId}$`));
  await page.getByRole('link', { name: 'Kóstoló másolása', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/host/new\\?from=${gameId}$`));
  await expect(page.getByLabel('Kóstoló címe')).toHaveValue('Őszi kóstoló – másolat');
  await expect(page.getByRole('group', { name: '1. tétel', exact: true }).getByLabel('Bor neve és évjárata')).toHaveValue('Első mintabor 2024');
  await page.getByRole('button', { name: 'Kóstoló létrehozása', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/host/${gameId}$`));
  expect(state.calls).toHaveLength(2);
  expect(state.calls[1].p_title).toBe('Őszi kóstoló – másolat');
});
