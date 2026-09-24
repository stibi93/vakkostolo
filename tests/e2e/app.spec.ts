import { expect, test } from '@playwright/test';

test('kezdőlap → próbakóstoló → újratöltés → kezdőlap', async ({ page }, testInfo) => {
  const demoRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/src\/demo\/|\/assets\/DemoApp-/.test(request.url())) demoRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A címke titok. A tipped szabad.' })).toBeVisible();
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
  await page.getByRole('link', { name: 'Vakpohár, kezdőlap' }).click();
  await expect(page.getByRole('heading', { name: 'A címke titok. A tipped szabad.' })).toBeVisible();
});

test('ismeretlen útvonalról vissza lehet térni a kezdőlapra', async ({ page }) => {
  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { name: 'Ez az oldal nincs a borsorban.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kóstoló indítása' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Vissza a kezdőlapra' }).click();
  await expect(page.getByRole('link', { name: 'Próbakóstoló megnyitása' })).toBeVisible();
});
