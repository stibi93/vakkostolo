import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { authSession, authUser } from '../fixtures/auth';

const gameId = '10000000-0000-0000-0000-000000000001';
const privateGameId = '10000000-0000-0000-0000-000000000002';
interface StoredGame {
  id: string; title: string; status: string; round_seconds: number; reveal_every: number; created_at: string;
  wines: { name: string; price_huf: number; alcohol_tenths: number; position: number }[];
}
interface CreatePayload {
  p_request_id: string; p_title: string; p_round_seconds: number; p_reveal_every: number;
  p_wines: { name: string; price_huf: number; alcohol_tenths: number }[];
}
async function setup(page: Page) {
  await page.addInitScript((session) => {
    if (!sessionStorage.getItem('fixture-ready')) {
      localStorage.setItem('sb-auth-auth-token', JSON.stringify(session));
      sessionStorage.setItem('fixture-ready', 'true');
    }
  }, authSession());
  const state = { game: null as StoredGame | null, calls: [] as CreatePayload[], loseFirstResponse: false,
    malformed: false, failList: false };
  await page.route('https://auth.vakpohar.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: authUser });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname === '/rest/v1/rpc/list_host_games') {
      if (state.failList) return route.fulfill({ status: 503, json: { message: 'fixture unavailable' } });
      return route.fulfill({ json: state.game ? [state.game] : [] });
    }
    if (url.pathname === '/rest/v1/rpc/create_game') {
      const body = route.request().postDataJSON() as CreatePayload;
      state.calls.push(body);
      expect(body).not.toHaveProperty('host_id');
      expect(body).not.toHaveProperty('status');
      if (!state.game) state.game = { id: gameId, title: body.p_title, status: 'draft',
        round_seconds: body.p_round_seconds, reveal_every: body.p_reveal_every, created_at: new Date().toISOString(),
        wines: body.p_wines.map((wine, i) => ({ ...wine, position: i+1 })) };
      if (state.loseFirstResponse && state.calls.length === 1) return route.abort('failed');
      return route.fulfill({ json: gameId });
    }
    if (url.pathname === '/rest/v1/rpc/get_host_game') {
      const body = route.request().postDataJSON() as { p_game_id: string };
      if (!state.game || body.p_game_id !== state.game.id) return route.fulfill({ status: 400, json: { message: 'GAME_NOT_FOUND', code: 'P0001' } });
      return route.fulfill({ json: state.malformed ? { ...state.game, wines: null } : state.game });
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
  await page.goto('/host');
  await expect(page.getByText('Még nincs mentett kóstolód.')).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Belépés Google-fiókkal' })).toBeVisible();
  await expect(page.getByLabel('Bor neve és évjárata')).toHaveCount(0);
});
