import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { User } from '@supabase/supabase-js';
import { authSession, authUser, googlePlayer } from '../fixtures/auth';

const authOrigin = `http://127.0.0.1:${Number(process.env.PLAYWRIGHT_BASE_PORT ?? 4173) + 1}`;
const password = 'Titkos-Jelszo-2026';
const inviteToken = 'Qx7'.repeat(14) + 'Z';

// Real Supabase JS client, synthetic HTTP responses: not a live Auth/MFA integration test.
async function mockAuth(page: Page, options: { user?: User; withFactor?: boolean } = {}) {
  const calls = { passwordLogins: 0, exchanges: 0, enrolls: 0, verifies: 0, logouts: 0, logoutScope: '',
    failUser: false, rejectCode: false, factorVerified: options.withFactor ?? true };
  const baseUser = options.user ?? authUser;
  const currentUser = (): User => baseUser === authUser
    ? { ...authUser, factors: calls.factorVerified ? authUser.factors : [] } : baseUser;
  await page.route('https://auth.vakkostolo.test/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      calls.passwordLogins++;
      const body = request.postDataJSON() as { email: string; password: string };
      if (body.email !== authUser.email || body.password !== password) {
        await route.fulfill({ status: 400, json: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
      } else {
        await route.fulfill({ json: authSession(currentUser(), 'aal1') });
      }
    } else if (path === '/auth/v1/authorize') {
      expect(url.searchParams.get('provider')).toBe('google');
      expect(url.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256');
      const callback = new URL(url.searchParams.get('redirect_to')!);
      expect(callback.origin).toBe(authOrigin);
      expect(callback.pathname).toBe('/auth/callback');
      callback.searchParams.set('code', 'synthetic-code');
      await route.fulfill({ status: 302, headers: { location: callback.href } });
    } else if (path === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      calls.exchanges++;
      await route.fulfill(calls.rejectCode ? { status: 400, json: { error: 'invalid_grant', message: 'synthetic expired code' } }
        : { json: authSession(googlePlayer) });
    } else if (path === '/auth/v1/user') {
      await route.fulfill(calls.failUser ? { status: 401, json: { message: 'synthetic unavailable session' } } : { json: currentUser() });
    } else if (path === '/auth/v1/factors' && request.method() === 'POST') {
      calls.enrolls++;
      await route.fulfill({ json: { id: 'factor-new', type: 'totp', friendly_name: 'Vakkóstoló',
        totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', secret: 'SYNTHETICSECRET', uri: 'otpauth://totp/x' } } });
    } else if (/^\/auth\/v1\/factors\/[^/]+\/challenge$/.test(path)) {
      await route.fulfill({ json: { id: 'challenge-1', type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 } });
    } else if (/^\/auth\/v1\/factors\/[^/]+\/verify$/.test(path)) {
      calls.verifies++;
      const body = request.postDataJSON() as { code: string };
      if (body.code !== '123456') {
        await route.fulfill({ status: 422, json: { code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' } });
      } else {
        calls.factorVerified = true;
        await route.fulfill({ json: authSession(currentUser(), 'aal2') });
      }
    } else if (path === '/auth/v1/logout') {
      calls.logouts++;
      calls.logoutScope = url.searchParams.get('scope') ?? '';
      await route.fulfill({ status: 204 });
    } else if (path === '/rest/v1/rpc/list_host_games') {
      await route.fulfill({ json: [{ id: '10000000-0000-0000-0000-000000000001', title: 'teszt kóstoló', status: 'finished',
        round_seconds: 120, reveal_every: 2, created_at: '2026-09-27T10:00:00.000Z' }] });
    } else if (path === '/rest/v1/rpc/join_game') {
      await route.fulfill({ status: 400, json: { code: 'P0001', message: 'NICKNAME_REQUIRED' } });
    } else if (path === '/rest/v1/rpc/preview_invite') {
      await route.fulfill({ json: { title: 'Pénteki kóstoló', joinable: true } });
    } else {
      await route.abort();
      throw new Error(`Unexpected mocked Auth endpoint: ${request.method()} ${path}`);
    }
  });
  return calls;
}

async function passwordSignIn(page: Page, secret = password) {
  await page.goto('/host');
  await page.getByLabel('Felhasználónév').fill('Admin');
  await page.getByLabel('Jelszó').fill(secret);
  await page.getByRole('button', { name: 'Belépés', exact: true }).click();
}
async function enterCode(page: Page, code = '123456') {
  await page.getByLabel('6 jegyű kód').fill(code);
  await page.getByRole('button', { name: /Ellenőrzés|Beállítás befejezése/ }).click();
}

test('superadmin: jelszó + hitelesítő kód → host → újratöltés → kijelentkezés', async ({ page }, testInfo) => {
  const calls = await mockAuth(page);
  await page.goto('/host');
  await expect(page.getByRole('button', { name: 'Belépés Google-fiókkal' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('host-sign-in.png'), fullPage: true });
  await passwordSignIn(page);
  await expect(page.getByRole('heading', { name: 'Második lépés: hitelesítő kód' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Saját kóstolóim' })).toHaveCount(0);
  await expect(page.getByLabel('Jelszó')).toHaveCount(0);
  await enterCode(page, '000000');
  await expect(page.getByRole('alert')).toContainText('nem megfelelő');
  await enterCode(page);
  await expect(page.getByRole('heading', { name: 'Saját kóstolóim' })).toBeVisible();
  await expect(page.getByText('Bejelentkezve: admin')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Játékmesteri fiók' })).toHaveCount(0);
  await expect(page.getByText('ONLINE BELÉPÉS')).toHaveCount(0);
  await expect(page.getByText('Létrehozott kóstoló')).toBeVisible();
  await expect(page.getByText('Befejezve')).toBeVisible();
  await expect(page.getByRole('link', { name: 'teszt kóstoló', exact: true })).toBeVisible();
  expect(calls.passwordLogins).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('host-authenticated.png'), fullPage: true });

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Saját kóstolóim' })).toBeVisible();
  expect(calls.verifies).toBe(2);
  await page.getByRole('button', { name: 'Kijelentkezés', exact: true }).click();
  await expect(page.getByLabel('Felhasználónév')).toBeVisible();
  expect(calls.logouts).toBe(1);
  expect(calls.logoutScope).toBe('local');
});

test('superadmin első belépése: hitelesítő app beállítása QR-kóddal', async ({ page }, testInfo) => {
  const calls = await mockAuth(page, { withFactor: false });
  await passwordSignIn(page);
  await expect(page.getByRole('heading', { name: 'Kétlépcsős azonosítás beállítása' })).toBeVisible();
  await page.getByRole('button', { name: 'Hitelesítő app beállítása' }).click();
  await expect(page.getByRole('img', { name: 'QR-kód a hitelesítő app beállításához' })).toBeVisible();
  await expect(page.getByText('SYNTHETICSECRET')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('host-mfa-setup.png'), fullPage: true });
  await enterCode(page);
  await expect(page.getByRole('heading', { name: 'Saját kóstolóim' })).toBeVisible();
  expect(calls.enrolls).toBe(1);
});

test('hibás jelszó vagy felhasználónév nem ad hostfelületet', async ({ page }) => {
  const calls = await mockAuth(page);
  await page.goto('/host');
  await page.getByLabel('Felhasználónév').fill('a b');
  await page.getByLabel('Jelszó').fill(password);
  await page.getByRole('button', { name: 'Belépés', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('3–32 karakter');
  expect(calls.passwordLogins).toBe(0);
  await passwordSignIn(page, 'rossz-jelszo');
  await expect(page.getByRole('alert')).toContainText('Hibás felhasználónév vagy jelszó.');
  await expect(page.getByLabel('Jelszó')).toHaveValue('');
  await expect(page.getByRole('heading', { name: /hitelesítő kód|Saját kóstolóim/ })).toHaveCount(0);
});

test('Google-fiókos játékos és anonim vendég nem kap játékmesteri felületet', async ({ page }) => {
  await mockAuth(page, { user: googlePlayer });
  await page.addInitScript((session) => localStorage.setItem('sb-auth-auth-token', JSON.stringify(session)), authSession(googlePlayer));
  await page.goto('/host');
  await expect(page.getByRole('heading', { name: 'Ez játékosfiók.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Saját kóstolóim' })).toHaveCount(0);

  const guest = await page.context().newPage();
  const anonymous = { ...googlePlayer, email: undefined, is_anonymous: true };
  await mockAuth(guest, { user: anonymous });
  await guest.addInitScript((session) => localStorage.setItem('sb-auth-auth-token', JSON.stringify(session)), authSession(anonymous));
  await guest.goto('/host');
  await expect(guest.getByRole('heading', { name: 'Most vendégként vagy belépve.' })).toBeVisible();
});

test('a helyi munkamenet nem elég: szerverhiba után újrapróbálás', async ({ page }) => {
  const calls = await mockAuth(page);
  await passwordSignIn(page);
  await enterCode(page);
  await expect(page.getByRole('heading', { name: 'Saját kóstolóim' })).toBeVisible();
  calls.failUser = true;
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Nem sikerült ellenőrizni');
  await expect(page.getByRole('heading', { name: 'Saját kóstolóim' })).toHaveCount(0);
  calls.failUser = false;
  await page.getByRole('button', { name: 'Újrapróbálás' }).click();
  await expect(page.getByRole('heading', { name: 'Saját kóstolóim' })).toBeVisible();
});

test('a kijelentkezés a másik böngészőlapon is megjelenik', async ({ page, context }) => {
  await mockAuth(page);
  await passwordSignIn(page);
  await enterCode(page);
  await expect(page.getByRole('heading', { name: 'Saját kóstolóim' })).toBeVisible();
  const other = await context.newPage();
  await mockAuth(other);
  await other.goto('/host');
  await expect(other.getByRole('heading', { name: 'Saját kóstolóim' })).toBeVisible();
  await page.getByRole('button', { name: 'Kijelentkezés', exact: true }).click();
  await expect(other.getByLabel('Felhasználónév')).toBeVisible();
});

test('játékos: opcionális Google-belépés után visszatér a meghívóhoz, becenév előtöltve', async ({ page }) => {
  const calls = await mockAuth(page, { user: googlePlayer });
  await page.goto(`/join/${inviteToken}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Pénteki kóstoló' })).toBeVisible();
  await page.getByRole('button', { name: 'Belépés Google-fiókkal' }).click();
  await expect(page).toHaveURL(`${authOrigin}/join/${inviteToken}`);
  await expect(page.getByText('Google-fiókkal vagy belépve (player@example.test)')).toBeVisible();
  await expect(page.getByLabel('Becenév')).toHaveValue('Kóstoló');
  await expect(page.getByRole('button', { name: 'Belépés Google-fiókkal' })).toHaveCount(0);
  expect(calls.exchanges).toBe(1);
});

test('megszakított vagy lejárt Google-belépés: tiszta URL, a játékos a meghívón marad', async ({ page }) => {
  const calls = await mockAuth(page, { user: googlePlayer });
  await page.goto('/auth/callback?error=access_denied&error_description=private-provider-detail');
  await expect(page.getByRole('alert')).toContainText('A belépés nem fejeződött be');
  await expect(page).toHaveURL(`${authOrigin}/auth/callback`);
  await expect(page.getByText('private-provider-detail')).toHaveCount(0);
  expect(calls.exchanges).toBe(0);

  calls.rejectCode = true;
  await page.goto(`/join/${inviteToken}`);
  await page.getByRole('button', { name: 'Belépés Google-fiókkal' }).click();
  await expect(page).toHaveURL(`${authOrigin}/join/${inviteToken}`);
  await expect(page.getByLabel('Becenév')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Belépés Google-fiókkal' })).toBeVisible();
  expect(calls.exchanges).toBe(1);
});
