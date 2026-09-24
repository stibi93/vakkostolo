import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { authSession, authUser } from '../fixtures/auth';

const authOrigin = `http://127.0.0.1:${Number(process.env.PLAYWRIGHT_BASE_PORT ?? 4173) + 1}`;

// Real Supabase JS client, synthetic HTTP responses: this is not a live OAuth integration test.
async function mockAuth(page: Page, anonymous = false) {
  const user = { ...authUser, is_anonymous: anonymous };
  const session = authSession(user);
  const calls = { exchanges: 0, logouts: 0, failUser: false, rejectCode: false, logoutScope: '' };
  await page.route('https://auth.vakkostolo.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/auth/v1/authorize') {
      expect(url.searchParams.get('provider')).toBe('google');
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      expect(url.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256');
      const callback = new URL(url.searchParams.get('redirect_to')!);
      expect(callback.origin).toBe(authOrigin);
      expect(callback.pathname).toBe('/auth/callback');
      callback.searchParams.set('code', 'synthetic-code');
      await route.fulfill({ status: 302, headers: { location: callback.href } });
    } else if (url.pathname === '/auth/v1/token') {
      calls.exchanges++;
      expect(url.searchParams.get('grant_type')).toBe('pkce');
      const body = route.request().postDataJSON() as { auth_code: string; code_verifier: string };
      expect(body.auth_code).toBe('synthetic-code');
      expect(body.code_verifier).toBeTruthy();
      await route.fulfill({ status: calls.rejectCode ? 400 : 200,
        json: calls.rejectCode ? { error: 'invalid_grant', message: 'synthetic expired code' } : session });
    } else if (url.pathname === '/auth/v1/user') {
      await route.fulfill({ status: calls.failUser ? 401 : 200,
        json: calls.failUser ? { message: 'synthetic unavailable session' } : user });
    } else if (url.pathname === '/auth/v1/logout') {
      calls.logouts++;
      calls.logoutScope = url.searchParams.get('scope') ?? '';
      await route.fulfill({ status: 204 });
    } else if (url.pathname === '/rest/v1/rpc/list_host_games') {
      await route.fulfill({ json: [] });
    } else {
      await route.abort();
      throw new Error(`Unexpected mocked Auth endpoint: ${url.pathname}`);
    }
  });
  return calls;
}

async function signIn(page: Page) {
  await page.goto('/host');
  await page.getByRole('button', { name: 'Belépés Google-fiókkal' }).click();
}

test('Google PKCE → host → újratöltés → helyi kijelentkezés', async ({ page }, testInfo) => {
  const calls = await mockAuth(page);
  await page.goto('/host');
  await expect(page.getByRole('button', { name: 'Belépés Google-fiókkal' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Ugrás a tartalomhoz' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Belépés Google-fiókkal' })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('host-sign-in.png'), fullPage: true });
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${authOrigin}/host`);
  await expect(page.getByRole('heading', { name: 'Játékmesteri fiók' })).toBeVisible();
  await expect(page.getByText('Bejelentkezve: host@example.test')).toBeVisible();
  expect(calls.exchanges).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('host-authenticated.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Játékmesteri fiók' })).toBeVisible();
  expect(calls.exchanges).toBe(1);
  await page.getByRole('button', { name: 'Kijelentkezés', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Belépés Google-fiókkal' })).toBeVisible();
  expect(calls.logouts).toBe(1);
  expect(calls.logoutScope).toBe('local');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Belépés Google-fiókkal' })).toBeVisible();
});

test('megszakított OAuth: tiszta URL és új belépési lehetőség', async ({ page }, testInfo) => {
  const calls = await mockAuth(page);
  await page.goto('/auth/callback?error=access_denied&error_description=private-provider-detail&next=https://outside.test');
  await expect(page.getByRole('alert')).toContainText('A belépés nem fejeződött be');
  await expect(page).toHaveURL(`${authOrigin}/auth/callback`);
  await expect(page.getByRole('button', { name: 'Új Google-belépés' })).toBeVisible();
  await expect(page.getByText('private-provider-detail')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('host-error.png'), fullPage: true });
  expect(calls.exchanges).toBe(0);
});

test('lejárt kód nem ad hostfelületet', async ({ page }) => {
  const calls = await mockAuth(page);
  calls.rejectCode = true;
  await signIn(page);
  await expect(page.getByRole('alert')).toContainText('Indíts új belépést');
  await expect(page).toHaveURL(`${authOrigin}/auth/callback`);
  await expect(page.getByRole('heading', { name: 'Játékmesteri fiók' })).toHaveCount(0);
  expect(calls.exchanges).toBe(1);
});

test('a helyi munkamenet nem elég: szerverhiba után újrapróbálás', async ({ page }) => {
  const calls = await mockAuth(page);
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Játékmesteri fiók' })).toBeVisible();
  calls.failUser = true;
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Nem sikerült ellenőrizni');
  await expect(page.getByRole('heading', { name: 'Játékmesteri fiók' })).toHaveCount(0);
  calls.failUser = false;
  await page.getByRole('button', { name: 'Újrapróbálás' }).click();
  await expect(page.getByRole('heading', { name: 'Játékmesteri fiók' })).toBeVisible();
});

test('anonim munkamenet nem nyit játékmesteri felületet', async ({ page }) => {
  await mockAuth(page, true);
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Most vendégként vagy belépve.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Játékmesteri fiók' })).toHaveCount(0);
});

test('a kijelentkezés a másik böngészőlapon is megjelenik', async ({ page, context }) => {
  await mockAuth(page);
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Játékmesteri fiók' })).toBeVisible();
  const other = await context.newPage();
  await mockAuth(other);
  await other.goto('/host');
  await expect(other.getByRole('heading', { name: 'Játékmesteri fiók' })).toBeVisible();
  await page.getByRole('button', { name: 'Kijelentkezés', exact: true }).click();
  await expect(other.getByRole('button', { name: 'Belépés Google-fiókkal' })).toBeVisible();
});
