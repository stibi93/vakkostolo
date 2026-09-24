import { expect, test } from '@playwright/test';

test('host → saját tipp → blokkos felfedés → végeredmény', async ({ page }, testInfo) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Helyi demó' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('host.png'), fullPage: true });
  await page.getByRole('button', { name: 'Kóstoló indítása' }).click();
  await page.getByRole('button', { name: 'Játékos', exact: true }).click();
  await page.getByLabel('Becsült palackár').fill('4900');
  await page.getByLabel('Becsült alkoholfok').fill('12,5');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('player.png'), fullPage: true });
  await page.getByRole('button', { name: 'Tipp beküldése' }).click();
  await expect(page.getByRole('status')).toContainText('Tipp elmentve');
  await page.getByRole('button', { name: 'Prezentáció' }).click();
  await expect(page.getByText('Dűlőjáró · Furmint 2024')).toHaveCount(0);
  await page.getByRole('button', { name: 'Játékmester', exact: true }).click();
  await page.getByRole('button', { name: 'Kör lezárása' }).click();
  await expect(page.getByRole('button', { name: 'Eredmények felfedése' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Következő tétel' }).click();
  await page.getByRole('button', { name: 'Kör lezárása' }).click();
  await page.getByRole('button', { name: 'Eredmények felfedése' }).click();
  await page.getByRole('button', { name: 'Prezentáció' }).click();
  await expect(page.getByRole('heading', { name: 'Dűlőjáró · Furmint 2024' })).toBeVisible();
  await expect(page.locator('.score-summary')).toContainText('100');
  await page.getByRole('button', { name: 'Játékmester', exact: true }).click();
  await page.getByRole('button', { name: 'Következő tétel' }).click();
  await page.getByRole('button', { name: 'Kör lezárása' }).click();
  await page.getByRole('button', { name: 'Eredmények felfedése' }).click();
  await page.getByRole('button', { name: 'Kóstoló befejezése' }).click();
  await expect(page.locator('.score-summary')).toContainText('Végeredmény');
  await expect(page.getByRole('heading', { name: 'Aranyóra · Olaszrizling 2024' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('results.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('lejárt időnél a játékos nem küldhet be és nem hosszabbítható a kör', async ({ page }) => {
  await page.clock.install();
  await page.goto('/demo');
  await page.getByLabel('Kóstolási idő').selectOption('60');
  await page.getByRole('button', { name: 'Kóstoló indítása' }).click();
  await page.getByRole('button', { name: 'Játékos', exact: true }).click();
  await page.clock.fastForward(61_000);
  await expect(page.getByRole('button', { name: 'Tipp beküldése' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Játékmester', exact: true }).click();
  await expect(page.getByRole('button', { name: '+30 másodperc' })).toBeDisabled();
});
