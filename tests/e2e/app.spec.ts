import { expect, test } from '@playwright/test';

test('kezdőlap → próbakóstoló → újratöltés → kezdőlap', async ({ page }, testInfo) => {
  const demoRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/src\/demo\/|\/assets\/DemoApp-/.test(request.url())) demoRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Vakborkóstoló, telefonon.' })).toBeVisible();
  await expect(page.getByText('A közös online kóstoló még készül.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Játékmestereknek' })).toBeVisible();
  await expect(page.locator('header').getByText('VAKBORKÓSTOLÓ', { exact: true })).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);
  expect(demoRequests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Ugrás a tartalomhoz' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await page.getByRole('link', { name: 'Próbakóstoló megnyitása' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole('button', { name: 'Kóstoló indítása' })).toBeVisible();
  await expect(page.locator('header').getByText('VAKBORKÓSTOLÓ', { exact: true })).toHaveCount(0);
  await expect(page.locator('footer')).not.toContainText('Vakkóstoló');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Kóstoló indítása' })).toBeVisible();
  await page.getByRole('link', { name: 'Vakkóstoló, kezdőlap' }).click();
  await expect(page.getByRole('heading', { name: 'Vakborkóstoló, telefonon.' })).toBeVisible();
});

test('ismeretlen útvonalról vissza lehet térni a kezdőlapra', async ({ page }) => {
  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { name: 'Az oldal nem található.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kóstoló indítása' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Vissza a kezdőlapra' }).click();
  await expect(page.getByRole('link', { name: 'Próbakóstoló megnyitása' })).toBeVisible();
});

test('konfiguráció nélkül a hostoldal tájékoztat és a demo elérhető marad', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Játékmestereknek', exact: true }).click();
  await expect(page).toHaveURL(/\/jatekmester$/);
  await expect(page.getByRole('heading', { name: 'Kóstoló szervezése' })).toBeVisible();
  await expect(page.locator('.home-ambient')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('A közös online kóstoló még készül.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Játékmesteri belépés', exact: true }).click();
  await expect(page).toHaveURL(/\/host$/);
  await expect(page.getByRole('heading', { name: 'A belépés még nem elérhető.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Belépés Google-fiókkal' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A belépés még nem elérhető.' })).toBeVisible();
  await page.getByRole('link', { name: 'Próbakóstoló megnyitása' }).click();
  await expect(page.getByRole('button', { name: 'Kóstoló indítása' })).toBeVisible();
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
  await page.getByRole('link', { name: 'Demó kipróbálása' }).scrollIntoViewIfNeeded();
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
  await page.getByRole('link', { name: 'Szervezői útmutató', exact: true }).click();
  await page.getByRole('link', { name: 'Játékmesteri belépés', exact: true }).click();
  await expect(page).toHaveURL(/\/host$/);
  await expect(page.locator('.home-ambient')).toHaveCount(0);
});

test('a képes útmutató ellenőrzőlistát és működő továbblépéseket ad', async ({ page }, testInfo) => {
  await page.goto('/');
  const guide = page.getByRole('region', { name: 'Készülj a kóstolóra' });
  const checklist = guide.locator('summary');
  await checklist.focus();
  await page.keyboard.press('Enter');
  await expect(guide.getByText('Számozd meg őket a kóstolás sorrendjében.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await guide.screenshot({ path: testInfo.outputPath('guide-expanded.png') });
  await page.keyboard.press('Enter');
  await expect(guide.getByText('Számozd meg őket a kóstolás sorrendjében.')).not.toBeVisible();
  await guide.getByRole('link', { name: 'Szervezői útmutató' }).click();
  await expect(page.getByRole('heading', { name: 'Kóstoló szervezése' })).toBeVisible();
  await page.goBack();
  await guide.getByRole('link', { name: 'Demó kipróbálása' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Kóstoló indítása' })).toBeVisible();
});
