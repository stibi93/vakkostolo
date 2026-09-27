import { expect, test } from '@playwright/test';

test('kezdőlap → játékosbelépés → újratöltés → kezdőlap', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Kóstolj vakon. Tippelj telefonon.' })).toBeVisible();
  await expect(page.getByText('A közös online kóstoló még készül.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Játékmestereknek' })).toBeVisible();
  await expect(page.locator('header').getByText('VAKBORKÓSTOLÓ', { exact: true })).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Ugrás a tartalomhoz' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await page.getByRole('link', { name: 'Csatlakozás a játékhoz' }).click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole('heading', { name: 'Csatlakozás a játékhoz' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('nincs beállítva');
  await expect(page.getByLabel('Meghívólink', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Csatlakozás a játékhoz' })).toBeVisible();
  await page.getByRole('link', { name: 'Vakkóstoló, kezdőlap' }).click();
  await expect(page.getByRole('heading', { name: 'Kóstolj vakon. Tippelj telefonon.' })).toBeVisible();
});

test('ismeretlen útvonalról vissza lehet térni a kezdőlapra', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Az oldal nem található.' })).toBeVisible();
  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { name: 'Az oldal nem található.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kóstoló indítása' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Vissza a kezdőlapra' }).click();
  await expect(page.getByRole('link', { name: 'Csatlakozás a játékhoz' })).toBeVisible();
});

test('konfiguráció nélkül a hostoldal jelzi, hogy a belépés nem elérhető', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Játékmestereknek', exact: true }).click();
  await expect(page).toHaveURL(/\/jatekmester$/);
  await expect(page.getByRole('heading', { name: 'Kóstoló szervezése' })).toBeVisible();
  await expect(page.locator('.home-ambient')).toHaveCount(1);
  await page.reload();
  await expect(page.getByText('A közös online kóstoló még készül.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Játékmesteri belépés', exact: true }).click();
  await expect(page).toHaveURL(/\/host$/);
  await expect(page.getByRole('heading', { name: 'A belépés még nem elérhető.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Belépés Google-fiókkal' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A belépés még nem elérhető.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Próbakóstoló megnyitása' })).toHaveCount(0);
  await expect(page.getByText('Supabase-kapcsolatot')).toBeVisible();
});

test('kezdőlapi háttérmozgás megállítható és követi a csökkentett mozgást', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Háttérmozgás szüneteltetése' });
  await page.locator('.harvest-artwork').scrollIntoViewIfNeeded();
  await expect(page.locator('.harvest-artwork')).toHaveClass(/harvest-running/);
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Háttérmozgás indítása' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.harvest-artwork')).not.toHaveClass(/harvest-running/);
  await expect(page.locator('.home-atmosphere')).not.toHaveClass(/home-motion-running/);
  await expect.poll(() => page.locator('.ambient-gust').first().evaluate(element => getComputedStyle(element).animationPlayState)).toBe('paused');
  await expect.poll(() => page.locator('.harvest-vine').evaluate(element => getComputedStyle(element).animationPlayState)).toBe('paused');
  await page.getByRole('button', { name: 'Háttérmozgás indítása' }).click();
  await expect(page.locator('.harvest-artwork')).toHaveClass(/harvest-running/);
  await expect(page.locator('.home-atmosphere')).toHaveClass(/home-motion-running/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Mozgás kikapcsolva' })).toBeDisabled();
  expect(await page.locator('.home-atmosphere').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator('.harvest-artwork')).not.toHaveClass(/harvest-running/);
});

test('a szüreti háttér képernyőn kívül megáll, visszatéréskor folytatódik', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const artwork = page.locator('.harvest-artwork');
  await artwork.scrollIntoViewIfNeeded();
  await expect(artwork).toHaveClass(/harvest-running/);
  await page.locator('.insight-research summary').last().scrollIntoViewIfNeeded();
  await expect(artwork).not.toHaveClass(/harvest-running/);
  await expect.poll(() => page.locator('.harvest-vine').evaluate(element => getComputedStyle(element).animationPlayState)).toBe('paused');
  await artwork.scrollIntoViewIfNeeded();
  await expect(artwork).toHaveClass(/harvest-running/);
});

test('a kezdőlapi fotó betöltődik, képhibánál is használható a belépés', async ({ page }) => {
  await page.goto('/');
  const photo = page.locator('.editorial-photo img').first();
  await photo.scrollIntoViewIfNeeded();
  await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1536);
  await page.route('**/images/harvest-grapes.jpg', route => route.abort());
  await page.reload();
  await page.locator('.editorial-gallery').scrollIntoViewIfNeeded();
  await expect(page.locator('.editorial-photo').first().locator('img')).toHaveCount(0);
  await expect(page.getByText('A kép nem érhető el.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Játékmestereknek', exact: true }).click();
  await page.getByRole('link', { name: 'Játékmesteri belépés', exact: true }).click();
  await expect(page).toHaveURL(/\/host$/);
  await expect(page.locator('.home-ambient')).toHaveCount(1);
});

test('a képes ismeretterjesztő blokk kutatásai billentyűzettel elérhetők', async ({ page }, testInfo) => {
  await page.goto('/');
  const insights = page.getByRole('region', { name: 'Mi befolyásolja a kóstolást?' });
  await expect(insights.getByRole('heading', { level: 3 })).toHaveCount(3);
  const sources = [
    'https://pubmed.ncbi.nlm.nih.gov/18622887/',
    'https://pubmed.ncbi.nlm.nih.gov/19501777/',
    'https://doi.org/10.1017/age.2023.11',
  ];
  for (let i = 0; i < sources.length; i++) {
    const detail = insights.locator('details').nth(i);
    const source = detail.getByRole('link');
    await expect(source).not.toBeVisible();
    await detail.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(source).toBeVisible();
    await expect(source).toHaveAttribute('href', sources[i]);
    await page.keyboard.press('Tab');
    await expect(source).toBeFocused();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await insights.screenshot({ path: testInfo.outputPath('insights-expanded.png') });
  await insights.locator('summary').first().focus();
  await page.keyboard.press('Enter');
  await expect(insights.locator('details').first().getByRole('link')).not.toBeVisible();
});


test('közös háttér minden útvonalon, navigáláskor megmaradó szüneteltetéssel', async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const routes = ['/', '/join', '/join/invalid', '/jatekmester', '/host', '/host/new', '/host/invalid', '/auth/callback', '/play/invalid', '/present/invalid', '/missing'];
  for (const [index, route] of routes.entries()) {
    await page.goto(route);
    await expect(page.getByText('Az oldal betöltése…', { exact: true })).toHaveCount(0);
    await expect(page.locator('.home-ambient')).toHaveCount(1);
    await expect(page.locator('.home-atmosphere')).toHaveClass(/home-motion-running/);
    const toggle = page.getByRole('button', { name: 'Háttérmozgás szüneteltetése' });
    await expect(toggle).toHaveCount(1);
    await toggle.click();
    await expect(page.locator('.home-atmosphere')).not.toHaveClass(/home-motion-running/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if ([1, 4, 9].includes(index)) {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: info.outputPath(`global-background-${index}.png`), fullPage: true });
    }
  }
  await page.getByRole('link', { name: 'Vissza a kezdőlapra' }).click();
  await page.getByRole('link', { name: 'Csatlakozás a játékhoz' }).click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole('button', { name: 'Háttérmozgás indítása' })).toBeVisible();
  await expect(page.locator('.home-atmosphere')).not.toHaveClass(/home-motion-running/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Mozgás kikapcsolva' })).toBeDisabled();
  expect(await page.locator('.home-ambient').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
});
