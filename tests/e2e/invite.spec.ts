import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { authSession, authUser } from '../fixtures/auth';

// Real Supabase JS client, synthetic HTTP responses: not a live Auth/RLS integration test.
const token = 'Qx7'.repeat(14) + 'Z';
const gameId = '10000000-0000-0000-0000-000000000001';
const guestUser = { ...authUser, id: '00000000-0000-0000-0000-000000000003', email: undefined, is_anonymous: true,
  app_metadata: { provider: 'anonymous', providers: ['anonymous'] } };
const membership = { game_id: gameId, participant_id: '30000000-0000-0000-0000-000000000001',
  nickname: 'Anna', title: 'Péntesti kóstoló', status: 'lobby' };
const postgrestError = (message: string) => ({ status: 400, json: { code: 'P0001', message, details: null, hint: null } });

async function mockSupabase(page: Page, handle: (route: Route, url: URL) => Promise<boolean>) {
  const unexpected: string[] = [];
  await page.route('https://auth.vakkostolo.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (!await handle(route, url)) {
      unexpected.push(url.pathname);
      await route.abort();
    }
  });
  return unexpected;
}

test('host: váró megnyitása, QR és link, újratöltés után is látható', async ({ page }) => {
  const calls = { issue: 0 };
  let participants: unknown[] = [];
  const unexpected = await mockSupabase(page, async (route, url) => {
    if (url.pathname === '/auth/v1/user') await route.fulfill({ json: authUser });
    else if (url.pathname === '/rest/v1/rpc/get_host_game') {
      await route.fulfill({ json: { id: gameId, title: 'Péntesti kóstoló', status: calls.issue ? 'lobby' : 'draft',
        round_seconds: 120, reveal_every: 2, created_at: '2026-09-24T08:00:00Z',
        wines: [{ position: 1, name: 'Titkos bor', price_huf: 4500, alcohol_tenths: 125 }] } });
    } else if (url.pathname === '/rest/v1/rpc/issue_invite') {
      calls.issue++;
      await route.fulfill({ json: { token, expires_at: new Date(Date.now() + 12 * 3600_000).toISOString(), status: 'lobby' } });
    } else if (url.pathname === '/rest/v1/participants') {
      expect(url.searchParams.get('game_id')).toBe(`eq.${gameId}`);
      await route.fulfill({ json: participants });
    } else return false;
    return true;
  });
  await page.addInitScript((session) => {
    if (!localStorage.getItem('sb-auth-auth-token')) localStorage.setItem('sb-auth-auth-token', JSON.stringify(session));
  }, authSession());

  await page.goto(`/host/${gameId}`);
  await page.getByRole('button', { name: 'Váró megnyitása' }).click();
  const qr = page.getByRole('img', { name: 'QR-kód a kóstolóba való belépéshez' });
  await expect(qr).toBeVisible();
  const origin = new URL(page.url()).origin;
  await expect(page.getByText(`${origin}/join/${token}`)).toBeVisible();
  await expect(page.getByText('Váró · 120 másodperc/bor', { exact: false })).toBeVisible();
  await expect(page.getByText('Még senki nem lépett be.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kivetítő nézet' })).toHaveAttribute('href', `/present/${gameId}`);
  expect((await qr.boundingBox())!.width).toBeGreaterThanOrEqual(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  participants = [{ id: membership.participant_id, nickname: 'Anna', joined_at: '2026-09-24T08:01:00Z' }];
  await page.reload();
  await expect(qr).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Résztvevők (1)' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Anna' })).toBeVisible();
  expect(calls.issue).toBe(1);
  expect(unexpected).toEqual([]);
});

test('kivetítő: QR, link és becenevek, boradatok lekérése nélkül', async ({ page }) => {
  const requested: string[] = [];
  const unexpected = await mockSupabase(page, async (route, url) => {
    requested.push(url.pathname);
    if (url.pathname === '/auth/v1/user') await route.fulfill({ json: authUser });
    else if (url.pathname === '/rest/v1/rpc/list_host_games') {
      await route.fulfill({ json: [{ id: gameId, title: 'Péntesti kóstoló', status: 'lobby', round_seconds: 120,
        reveal_every: 2, created_at: '2026-09-24T08:00:00Z' }] });
    } else if (url.pathname === '/rest/v1/participants') {
      await route.fulfill({ json: [{ id: membership.participant_id, nickname: 'Anna', joined_at: '2026-09-24T08:01:00Z' }] });
    } else return false;
    return true;
  });
  await page.addInitScript(({ session, key, invite }) => {
    if (!localStorage.getItem('sb-auth-auth-token')) localStorage.setItem('sb-auth-auth-token', JSON.stringify(session));
    if (!sessionStorage.getItem('invite-seeded')) {
      localStorage.setItem(key, JSON.stringify(invite));
      sessionStorage.setItem('invite-seeded', '1');
    }
  }, { session: authSession(), key: `vakkostolo:invite:${gameId}`,
    invite: { token, expiresAt: new Date(Date.now() + 3600_000).toISOString() } });

  await page.goto(`/present/${gameId}`);
  await expect(page.getByRole('heading', { name: 'Péntesti kóstoló' })).toBeVisible();
  const qr = page.getByRole('img', { name: 'QR-kód a kóstolóba való belépéshez' });
  await expect(qr).toBeVisible();
  await expect(page.getByText(`${new URL(page.url()).origin}/join/${token}`)).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Anna' })).toBeVisible();
  await expect(page.getByText(/Titkos bor|Ft|% vol|Kijelentkezés/)).toHaveCount(0);
  expect(requested).not.toContain('/rest/v1/rpc/get_host_game');
  expect((await qr.boundingBox())!.width).toBeGreaterThanOrEqual(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.evaluate((key) => localStorage.removeItem(key), `vakkostolo:invite:${gameId}`);
  await page.reload();
  await expect(page.getByText('nincs érvényes meghívó', { exact: false })).toBeVisible();
  expect(unexpected).toEqual([]);
});

test('vendég: becenév, anonim belépés, újratöltés után megmaradó tagság', async ({ page }) => {
  const calls = { signups: 0, joins: [] as Record<string, unknown>[] };
  const unexpected = await mockSupabase(page, async (route, url) => {
    if (url.pathname === '/auth/v1/signup') {
      calls.signups++;
      await route.fulfill({ json: authSession(guestUser) });
    } else if (url.pathname === '/rest/v1/rpc/join_game') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.joins.push(body);
      await route.fulfill(body.p_nickname || calls.joins.length > 1 ? { json: membership } : postgrestError('NICKNAME_REQUIRED'));
    } else return false;
    return true;
  });

  await page.goto(`/join/${token}`);
  const nickname = page.getByLabel('Becenév');
  await expect(nickname).toBeVisible();
  expect(calls.signups).toBe(0);
  await page.getByRole('button', { name: 'Belépés a váróba' }).click();
  await expect(page.getByRole('alert')).toContainText('Adj meg egy becenevet.');
  expect(calls.signups).toBe(0);
  await nickname.fill('  Anna ');
  await nickname.press('Enter');
  await expect(page.getByRole('heading', { name: 'Péntesti kóstoló' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Bent vagy a váróban Anna néven.');
  expect(calls.signups).toBe(1);
  expect(calls.joins).toEqual([{ p_token: token, p_nickname: 'Anna' }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.reload();
  await expect(page.getByRole('status')).toContainText('Bent vagy a váróban Anna néven.');
  await expect(nickname).toHaveCount(0);
  expect(calls.signups).toBe(1);
  expect(calls.joins.at(-1)).toEqual({ p_token: token });
  expect(unexpected).toEqual([]);
});

test('vendég: érvénytelen vagy lecserélt meghívó', async ({ page }) => {
  const unexpected = await mockSupabase(page, async (route, url) => {
    if (url.pathname === '/auth/v1/signup') await route.fulfill({ json: authSession(guestUser) });
    else if (url.pathname === '/rest/v1/rpc/join_game') await route.fulfill(postgrestError('INVITE_INVALID'));
    else return false;
    return true;
  });
  await page.goto('/join/rovid');
  await expect(page.getByRole('heading', { name: 'Ez a meghívó nem érvényes.' })).toBeVisible();
  await page.goto(`/join/${token}`);
  await page.getByLabel('Becenév').fill('Anna');
  await page.getByRole('button', { name: 'Belépés a váróba' }).click();
  await expect(page.getByRole('alert')).toContainText('Kérj új linket vagy QR-kódot.');
  expect(unexpected).toEqual([]);
});
