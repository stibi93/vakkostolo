import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { authSession, authUser } from '../fixtures/auth';
import { lobbyResponse, realtimeHub } from './support/lobby';

const gameId = '10000000-0000-0000-0000-000000000001';
const token = 'Qx7'.repeat(14) + 'Z';
const membershipId = (index: number) => `30000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
function mockGame() {
  const hub = realtimeHub();
  const participants: { id: string; nickname: string; joined_at: string; seat: number }[] = [];
  let status = 'lobby';
  return {
    hub, participants,
    changeStatus(value: string) { status = value; hub.change(gameId, 'games'); },
    async connect(page: Page, index: number) {
      const host = index === 0;
      const state = { requests: 0, fail: false, denied: false, malformed: false };
      const user = host ? authUser : { ...authUser, id: membershipId(index), email: undefined, is_anonymous: true };
      await hub.attach(page);
      if (host) await page.addInitScript((session) => localStorage.setItem('sb-auth-auth-token', JSON.stringify(session)), authSession(user));
      await page.route('https://auth.vakkostolo.test/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/auth/v1/user') return route.fulfill({ json: user });
        if (path === '/auth/v1/signup') return route.fulfill({ json: authSession(user) });
        if (path === '/rest/v1/rpc/get_host_game') return route.fulfill({ json: {
          id: gameId, title: 'Péntesti kóstoló', status, round_seconds: 120, reveal_every: 2,
          created_at: new Date().toISOString(), wines: [{ round_id: '20000000-0000-0000-0000-000000000001', photo_updated_at: null, photo_locked: false, position: 1, name: 'Titkos pincészet', price_huf: 4567, alcohol_tenths: 137 }],
        } });
        if (path === '/rest/v1/rpc/preview_invite') {
          return route.fulfill(route.request().postDataJSON().p_token === token
            ? { json: { title: 'Péntesti kóstoló', joinable: true } } : { status: 400, json: { message: 'INVITE_INVALID' } });
        }
        if (path === '/rest/v1/rpc/join_game') {
          const data = route.request().postDataJSON();
          if (data.p_token !== token) return route.fulfill({ status: 400, json: { message: 'INVITE_INVALID' } });
          if (!participants.find((p) => p.id === membershipId(index))) {
            if (!data.p_nickname) return route.fulfill({ status: 400, json: { message: 'NICKNAME_REQUIRED' } });
            participants.push({ id: membershipId(index), nickname: data.p_nickname, joined_at: new Date().toISOString(), seat: participants.length + 1 });
            hub.change(gameId);
          }
          return route.fulfill({ json: { game_id: gameId, participant_id: membershipId(index), nickname: data.p_nickname ?? 'Anna', title: 'Péntesti kóstoló', status } });
        }
        if (path === '/rest/v1/rpc/get_game_snapshot') {
          state.requests++;
          const requested = route.request().postDataJSON().p_game_id;
          if (state.denied || requested !== gameId || (!host && !participants.some((p) => p.id === membershipId(index)))) {
            return route.fulfill({ status: 400, json: { message: 'GAME_NOT_FOUND' } });
          }
          if (state.fail) return route.fulfill({ status: 503, json: { message: 'fixture failure' } });
          return route.fulfill({ json: state.malformed ? {} : lobbyResponse(gameId, participants, host ? 'host' : 'player', host ? null : membershipId(index), status) });
        }
        if (path === '/rest/v1/rpc/resume_membership') return route.fulfill({ json: {
          game_id: gameId, participant_id: membershipId(index), nickname: 'Anna', title: 'Péntesti kóstoló', status, reclaim_saved: true } });
        await route.abort(); throw new Error(`Unexpected endpoint ${path}`);
      });
      return state;
    },
  };
}
async function join(page: Page, nickname = 'Anna') {
  await page.goto(`/join/${token}`);
  await page.getByLabel('Becenév').fill(nickname);
  await page.getByLabel('Becenév').press('Enter');
  await expect(page).toHaveURL(new RegExp(`/play/${gameId}$`));
  await expect(page.getByText('Élő kapcsolat.', { exact: true })).toBeVisible();
}

test('host és két külön vendég élő listája, azonos becenevek, esemény és újratöltés', async ({ page, browser }, info) => {
  const game = mockGame();
  await game.connect(page, 0);
  const oneContext = await browser.newContext({ ...info.project.use });
  const twoContext = await browser.newContext({ ...info.project.use });
  try {
    const one = await oneContext.newPage(), two = await twoContext.newPage();
    await game.connect(one, 1); await game.connect(two, 2);
    await page.goto(`/host/${gameId}`);
    await expect(page.getByText('Élő kapcsolat.', { exact: true })).toBeVisible();
    await expect(page.getByText('Még senki nem lépett be.')).toBeVisible();
    await join(one); await join(two);
    await expect.poll(() => game.hub.size()).toBe(3);
    for (const target of [page, one, two]) {
      await expect(target.getByRole('heading', { name: 'Résztvevők (2)' })).toBeVisible();
      await expect(target.getByRole('listitem').filter({ hasText: 'Anna' })).toHaveCount(2);
      await expect(target.getByText('Eseményből nem megjelenítendő')).toHaveCount(0);
      expect(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await expect(two.getByText('Saját jelölésed:', { exact: false })).toContainText('#02');
    await expect(one.getByText('Titkos pincészet')).toHaveCount(0);
    await one.screenshot({ path: info.outputPath('guest-lobby.png'), fullPage: true });
    await page.screenshot({ path: info.outputPath('host-lobby.png'), fullPage: true });
    await expect(page.getByText('2 bent van most')).toBeVisible();
    await expect(page.locator('.lobby-participants li.is-online')).toHaveCount(2);
    await expect.poll(() => game.hub.watchers(gameId)).toBe(3);
    await one.reload();
    await expect(one.getByRole('heading', { name: 'Résztvevők (2)' })).toBeVisible();
    await expect(one.getByLabel('Becenév')).toHaveCount(0);
    await expect(page.getByText('2 bent van most')).toBeVisible();
    await two.goto('/');
    await expect.poll(() => game.hub.watchers(gameId)).toBe(2);
    await expect(page.getByText('1 bent van most')).toBeVisible();
    await expect(page.locator('.lobby-participants li.is-away')).toHaveCount(1);
    await expect(one.locator('.lobby-participants li.is-away')).toContainText('nincs bent');
    await expect(page.getByRole('heading', { name: 'Résztvevők (2)' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('host-lobby-away.png'), fullPage: true });
    game.changeStatus('tasting');
    await expect(one.getByText('A kóstoló már folyamatban van.')).toBeVisible();
  } finally { await oneContext.close(); await twoContext.close(); }
});

test('offline, HTTP-hiba, billentyűzetes újrapróbálás és hozzáférésvesztés', async ({ page }, info) => {
  const game = mockGame(); const state = await game.connect(page, 1); await join(page);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByRole('status')).toContainText('Nincs hálózati kapcsolat.');
  await expect(page.getByRole('button', { name: 'Újrapróbálás' })).toHaveCount(0);
  state.fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('alert')).toContainText('nem frissíthető');
  await expect(page.getByRole('heading', { name: 'Résztvevők (1)' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('stale-lobby.png'), fullPage: true });
  state.fail = false;
  await page.getByRole('button', { name: 'Újrapróbálás' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
  state.denied = true; game.hub.change(gameId);
  await expect(page.getByRole('alert')).toContainText('jelenlegi belépéseddel');
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('denied-lobby.png'), fullPage: true });
});

test('kimaradt eseményt polling és háttérből visszatérés javít, idegen játék tiltott', async ({ page }) => {
  const game = mockGame(); const state = await game.connect(page, 1);
  await page.clock.install(); await join(page);
  const requests = state.requests;
  game.participants.push({ id: membershipId(2), nickname: 'Második', joined_at: new Date().toISOString(), seat: 2 });
  await page.clock.runFor(15_001);
  await expect(page.getByRole('heading', { name: 'Résztvevők (2)' })).toBeVisible();
  expect(state.requests).toBeGreaterThan(requests);
  state.malformed = true;
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await expect(page.getByRole('alert')).toContainText('nem értelmezhető');
  state.malformed = false;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.goto('/play/10000000-0000-0000-0000-000000000099');
  await expect(page.getByRole('alert')).toContainText('jelenlegi belépéseddel');
  await expect(page.getByRole('listitem')).toHaveCount(0);
});

test('élő kapcsolat pulzál, hibánál leáll; váróháttér megállítható', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const game = mockGame(); const state = await game.connect(page, 1); await join(page);
  const indicator = page.locator('.lobby-connection');
  const animation = () => indicator.evaluate(element => getComputedStyle(element, '::before').animationName);
  await expect.poll(animation).toBe('connection-heartbeat');
  await expect(page.locator('.player-session')).toHaveClass(/player-waiting/);
  await page.evaluate(() => document.getAnimations().forEach(a => { if (a.effect?.getTiming().iterations === Infinity) a.currentTime = 2700; }));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath('lobby-motion.png'), fullPage: true });
  await page.getByRole('button', { name: 'Háttérmozgás szüneteltetése' }).click();
  await expect(page.locator('.home-atmosphere')).not.toHaveClass(/home-motion-running/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(animation).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(animation).toBe('connection-heartbeat');
  state.fail = true; game.hub.change(gameId);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect.poll(animation).toBe('none');
  await expect(indicator).not.toHaveClass(/lobby-connection-live/);
  state.fail = false;
  await page.getByRole('button', { name: 'Újrapróbálás' }).click();
  await expect.poll(animation).toBe('connection-heartbeat');
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(indicator).toHaveClass(/lobby-connection-offline/);
  await expect.poll(animation).toBe('none');
});
