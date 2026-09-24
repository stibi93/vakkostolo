import { defineConfig, devices } from '@playwright/test';

const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {};
const desktop = { ...devices['Desktop Chrome'] };
const mobile = { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } };

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', launchOptions },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      // Never pick up a developer's real project or reuse a differently configured server.
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      env: { VITE_SUPABASE_URL: 'https://auth.vakpohar.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_fixture' },
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: 'desktop-chromium', testIgnore: 'auth.spec.ts', use: desktop },
    { name: 'mobile-chromium', testIgnore: 'auth.spec.ts', use: mobile },
    { name: 'auth-desktop', testMatch: 'auth.spec.ts', use: { ...desktop, baseURL: 'http://127.0.0.1:4174' } },
    { name: 'auth-mobile', testMatch: 'auth.spec.ts', use: { ...mobile, baseURL: 'http://127.0.0.1:4174' } },
  ],
});
