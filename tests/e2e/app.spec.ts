import { expect, test } from '@playwright/test';

test('kezdőlap → próbakóstoló → újratöltés → kezdőlap', async ({ page }, testInfo) => {
  const demoRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/src\/demo\/|\/assets\/DemoApp-/.test(request.url())) demoRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Vakborkóstoló, telefonon.' })).toBeVisible();
  await expect(page.getByText('A közös online kóstoló még készül.', { exact: false })).toBeVisible();
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
  await toggle.scrollIntoViewIfNeeded();
  await expect(page.locator('.harvest-artwork')).toHaveClass(/harvest-running/);
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Háttérmozgás indítása' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.harvest-artwork')).not.toHaveClass(/harvest-running/);
  await expect.poll(() => page.locator('.harvest-vine').evaluate(element => getComputedStyle(element).animationPlayState)).toBe('paused');
  await page.getByRole('button', { name: 'Háttérmozgás indítása' }).click();
  await expect(page.locator('.harvest-artwork')).toHaveClass(/harvest-running/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Mozgás kikapcsolva' })).toBeDisabled();
  expect(await page.locator('.harvest-artwork').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator('.harvest-artwork')).not.toHaveClass(/harvest-running/);
});

test('a szüreti háttér képernyőn kívül megáll, visszatéréskor folytatódik', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 600 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const artwork = page.locator('.harvest-artwork');
  await artwork.scrollIntoViewIfNeeded();
  await expect(artwork).toHaveClass(/harvest-running/);
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect(artwork).not.toHaveClass(/harvest-running/);
  await expect.poll(() => page.locator('.harvest-vine').evaluate(element => getComputedStyle(element).animationPlayState)).toBe('paused');
  await artwork.scrollIntoViewIfNeeded();
  await expect(artwork).toHaveClass(/harvest-running/);
});
