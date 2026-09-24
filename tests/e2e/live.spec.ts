import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { authSession, authUser } from '../fixtures/auth';
import { lobbyResponse, realtimeHub } from './support/lobby';
const gameId = '10000000-0000-0000-0000-000000000001';
const roundId = '20000000-0000-0000-0000-000000000001';
const member = (index: number) => `30000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
interface RatingRow { round_id: string; price_huf: number; alcohol_tenths: number; liking: number; submitted_at: string }
function fixture() {
  const hub = realtimeHub();
  const saved = new Map<number, RatingRow>();
  const state = { started: false, opened: Date.now(), deadline: Date.now() + 120_000, version: 1,
    startCalls: [] as Record<string, unknown>[], submitCalls: [] as Record<string, unknown>[],
    failStart: false, failSubmit: false, loseSubmit: false, failRead: false, deny: false, expired: false, late: false };
  const participants = [1, 2].map(index => ({ id: member(index), nickname: `Vendég ${index}`, joined_at: new Date(Date.now()-60_000).toISOString(), seat: index }));
  function begin() { state.started = true; state.opened = Date.now(); state.deadline = Date.now() + 120_000; state.version = 2; hub.change(gameId, 'rounds'); hub.change(gameId, 'games'); }
  return { state, saved, begin, hub,
    async attach(page: Page, index: number) {
      const user = index ? { ...authUser, id: member(index), email: undefined, is_anonymous: true } : authUser;
      await page.addInitScript(session => {
        if (!localStorage.getItem('sb-auth-auth-token')) localStorage.setItem('sb-auth-auth-token', JSON.stringify(session));
      }, authSession(user));
      await hub.attach(page);
      await page.route('https://auth.vakkostolo.test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/auth/v1/user') return route.fulfill({ json: user });
        if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });
        if (path === '/rest/v1/rpc/get_host_game') return route.fulfill({ json: {
          id: gameId, title: 'Élő kóstoló', status: state.started ? 'tasting' : 'lobby', round_seconds: 120, reveal_every: 2,
          created_at: new Date().toISOString(), wines: [{ position: 1, name: 'Rejtett pincészet', price_huf: 9876, alcohol_tenths: 142 }],
        } });
        if (path === '/rest/v1/rpc/get_game_snapshot') {
          if (state.failRead) return route.fulfill({ status: 503, json: { message: 'unavailable' } });
          if (state.deny) return route.fulfill({ status: 400, json: { message: 'GAME_NOT_FOUND' } });
          return route.fulfill({ json: { ...lobbyResponse(gameId, participants, index ? 'player' : 'host', index ? member(index) : null),
            game: { id: gameId, title: 'Élő kóstoló', status: state.started ? 'tasting' : 'lobby', version: state.version },
            // Server clock is independent of Playwright's emulated client clock.
            server_now: new Date().toISOString(), round: state.started ? { id: roundId, position: 1, status: 'open',
              opened_at: new Date(state.opened).toISOString(), closes_at: new Date(state.deadline).toISOString(),
              eligible: index > 0 && !state.late, can_submit: index > 0 && !state.late && !state.expired && Date.now() < state.deadline } : null,
            own_rating: saved.get(index) ?? null,
          } });
        }
        if (path === '/rest/v1/rpc/start_round') {
          state.startCalls.push(route.request().postDataJSON());
          if (state.failStart) return route.abort('failed');
          if (!state.started) begin();
          return route.fulfill({ json: roundId });
        }
        if (path === '/rest/v1/rpc/submit_rating') {
          const input = route.request().postDataJSON(); state.submitCalls.push(input);
          if (state.expired) return route.fulfill({ status: 400, json: { message: 'DEADLINE_PASSED' } });
          if (state.failSubmit) return route.abort('failed');
          saved.set(index, { round_id: roundId, price_huf: input.p_price_huf, alcohol_tenths: input.p_alcohol_tenths,
            liking: input.p_liking, submitted_at: new Date().toISOString() });
          if (state.loseSubmit) return route.abort('failed');
          return route.fulfill({ json: saved.get(index) });
        }
        await route.abort(); throw new Error(`Unexpected endpoint: ${path}`);
      });
    },
  };
}
async function fill(page: Page, price = '4500') {
  await page.getByLabel('Becsült palackár (Ft)').fill(price);
  await page.getByLabel('Becsült alkoholfok (% vol)').fill('13,5');
  await page.getByLabel('Tetszés (1–10)').selectOption('8');
}
test('host indít, két vendég automatikusan értékel; mentés, módosítás, újratöltés', async ({ page, browser }, info) => {
  const f = fixture(); await f.attach(page, 0);
  const context1 = await browser.newContext({ ...info.project.use }), context2 = await browser.newContext({ ...info.project.use });
  try {
    const one = await context1.newPage(), two = await context2.newPage();
    await f.attach(one, 1); await f.attach(two, 2);
    await page.goto(`/host/${gameId}`); await one.goto(`/play/${gameId}`); await two.goto(`/play/${gameId}`);
    await expect.poll(() => f.hub.size()).toBe(3);
    await page.getByRole('button', { name: 'Első kör indítása' }).click();
    for (const guest of [one, two]) {
      await expect(guest.getByRole('heading', { name: '01. tétel' })).toBeVisible();
      await expect(guest.getByText('Rejtett pincészet')).toHaveCount(0);
      await expect(guest.getByRole('button', { name: 'Tipp beküldése' })).toBeEnabled();
    }
    await one.getByRole('button', { name: 'Tipp beküldése' }).click();
    await expect(one.getByRole('alert')).toBeFocused(); expect(f.state.submitCalls).toHaveLength(0);
    await fill(one); await one.getByLabel('Becsült alkoholfok (% vol)').press('Enter');
    await expect(one.getByText('A szerver által mentett tipped')).toBeVisible();
    await expect(two.getByText('A szerver által mentett tipped')).toHaveCount(0);
    await fill(one, '6000'); f.hub.change(gameId, 'rounds');
    await one.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
    await expect(one.getByLabel('Becsült palackár (Ft)')).toHaveValue('6000');
    await one.getByRole('button', { name: 'Tipp módosítása' }).click();
    await expect.poll(() => f.saved.get(1)?.price_huf).toBe(6000);
    await one.reload(); await expect(one.getByLabel('Becsült palackár (Ft)')).toHaveValue('6000');
    expect(f.saved.size).toBe(1); expect(f.state.startCalls).toHaveLength(1);
    await fill(two, '7000'); await two.getByRole('button', { name: 'Tipp beküldése' }).click();
    await expect(two.getByText('A szerver által mentett tipped')).toBeVisible(); expect(f.saved.size).toBe(2);
    await one.screenshot({ path: info.outputPath('live-player-saved.png'), fullPage: true });
    await page.screenshot({ path: info.outputPath('live-host.png'), fullPage: true });
    for (const target of [page, one, two]) expect(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context1.close(); await context2.close(); }
});
test('indítási hálózathiba ugyanazzal a kérésazonosítóval ismételhető', async ({ page }) => {
  const f = fixture(); await f.attach(page, 0); f.state.failStart = true;
  await page.goto(`/host/${gameId}`); await page.getByRole('button', { name: 'Első kör indítása' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  f.state.failStart = false; await page.getByRole('button', { name: 'Első kör indítása' }).click();
  await expect(page.getByRole('region', { name: 'Aktuális kör' })).toBeVisible();
  expect(f.state.startCalls).toHaveLength(2); expect(f.state.startCalls[0]).toEqual(f.state.startCalls[1]);
});
test('offline és elveszett mentési válasz: piszkozat megmarad, szerverállapot visszatér', async ({ page }, info) => {
  const f = fixture(); f.begin(); await f.attach(page, 1); await page.goto(`/play/${gameId}`); await fill(page);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByRole('button', { name: 'Tipp beküldése' })).toBeDisabled();
  await expect(page.getByLabel('Becsült palackár (Ft)')).toHaveValue('4500');
  f.state.failRead = true; await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByRole('button', { name: 'Tipp beküldése' })).toBeDisabled();
  f.state.failRead = false; await page.getByRole('button', { name: 'Újrapróbálás' }).click();
  f.state.failSubmit = true; await page.getByRole('button', { name: 'Tipp beküldése' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('A szerver által mentett tipped')).toHaveCount(0);
  await expect(page.getByLabel('Becsült palackár (Ft)')).toHaveValue('4500');
  f.state.failSubmit = false; f.state.loseSubmit = true;
  await page.getByRole('button', { name: 'Tipp beküldése' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('A szerver által mentett tipped')).toBeVisible();
  await page.screenshot({ path: info.outputPath('live-recovered.png'), fullPage: true });
  await page.reload(); await expect(page.getByLabel('Becsült palackár (Ft)')).toHaveValue('4500');
  f.state.deny = true; f.hub.change(gameId, 'games');
  await expect(page.getByText('A szerver által mentett tipped')).toHaveCount(0);
  await expect(page.getByLabel('Becsült palackár (Ft)')).toHaveCount(0);
});
test('szerver elutasítja a lejárt módosítást és a kliensóra sem nyújtja a határidőt', async ({ page }, info) => {
  const f = fixture(); f.begin(); await f.attach(page, 1); await page.clock.install({ time: new Date('2020-01-01') });
  await page.goto(`/play/${gameId}`); await fill(page); f.state.expired = true;
  await page.getByRole('button', { name: 'Tipp beküldése' }).click();
  await expect(page.getByRole('alert')).toContainText('Lejárt az idő'); expect(f.saved.size).toBe(0);
  await expect(page.getByRole('button', { name: 'Tipp beküldése' })).toBeDisabled();
  f.state.expired = false; f.hub.change(gameId, 'rounds');
  await expect(page.getByRole('button', { name: 'Tipp beküldése' })).toBeEnabled();
  await page.clock.fastForward(121_000);
  // The 15s poll can resync with the independent server; make expiry authoritative too.
  f.state.deadline = Date.now() - 1000; f.state.opened = f.state.deadline - 120_000; f.hub.change(gameId, 'rounds');
  await expect(page.getByRole('timer')).toHaveText('00:00');
  await page.screenshot({ path: info.outputPath('live-expired.png'), fullPage: true });
  await expect(page.getByRole('button', { name: 'Tipp beküldése' })).toBeDisabled();
});
test('későn érkezőnek nincs beküldőlap', async ({ page }, info) => {
  const f = fixture(); f.begin(); f.state.late = true; await f.attach(page, 1);
  await page.goto(`/play/${gameId}`);
  await expect(page.getByText('Ehhez a körhöz későn érkeztél.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tipp beküldése' })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('live-late.png'), fullPage: true });
});

test('jogvesztés után a függő beküldés válasza nem hozza vissza a játékoslapot', async ({ page }) => {
  const f = fixture(); f.begin(); await f.attach(page, 1);
  let reply: (() => Promise<void>) | undefined;
  await page.route('**/rest/v1/rpc/submit_rating', async route => {
    reply = () => route.fulfill({ json: { round_id: roundId, price_huf: 4500, alcohol_tenths: 135, liking: 8, submitted_at: new Date().toISOString() } });
  });
  await page.goto(`/play/${gameId}`); await fill(page);
  await page.getByRole('button', { name: 'Tipp beküldése' }).click();
  await expect.poll(() => !!reply).toBe(true);
  f.state.deny = true; f.hub.change(gameId, 'games');
  await expect(page.getByRole('alert')).toContainText('jelenlegi belépéseddel');
  await expect(page.getByLabel('Becsült palackár (Ft)')).toHaveCount(0);
  await reply!();
  await expect(page.getByText('A szerver által mentett tipped')).toHaveCount(0);
  await expect(page.getByLabel('Becsült palackár (Ft)')).toHaveCount(0);
});
