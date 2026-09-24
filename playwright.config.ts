import { defineConfig, devices } from '@playwright/test';

const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {};
const desktop = { ...devices['Desktop Chrome'] };
const mobile = { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } };
const appPort = Number(process.env.PLAYWRIGHT_BASE_PORT ?? 4173);
const authPort = appPort + 1;
const appUrl = `http://127.0.0.1:${appPort}`;
const authUrl = `http://127.0.0.1:${authPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: appUrl, trace: 'retain-on-failure', launchOptions },
  webServer: [
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${appPort} --strictPort`,
      url: appUrl,
      // Never pick up a developer's real project or reuse a differently configured server.
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${authPort} --strictPort`,
      url: authUrl,
      env: { VITE_SUPABASE_URL: 'https://auth.vakkostolo.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_fixture' },
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: 'desktop-chromium', testIgnore: ['auth.spec.ts', 'games.spec.ts', 'invite.spec.ts', 'lobby.spec.ts', 'live.spec.ts', 'schedule.spec.ts', 'photos.spec.ts'], use: desktop },
    { name: 'mobile-chromium', testIgnore: ['auth.spec.ts', 'games.spec.ts', 'invite.spec.ts', 'lobby.spec.ts', 'live.spec.ts', 'schedule.spec.ts', 'photos.spec.ts'], use: mobile },
    { name: 'auth-desktop', testMatch: ['auth.spec.ts', 'games.spec.ts', 'invite.spec.ts', 'lobby.spec.ts', 'live.spec.ts', 'schedule.spec.ts', 'photos.spec.ts'], use: { ...desktop, baseURL: authUrl } },
    { name: 'auth-mobile', testMatch: ['auth.spec.ts', 'games.spec.ts', 'invite.spec.ts', 'lobby.spec.ts', 'live.spec.ts', 'schedule.spec.ts', 'photos.spec.ts'], use: { ...mobile, baseURL: authUrl } },
  ],
});
