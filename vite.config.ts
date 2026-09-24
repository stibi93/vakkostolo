import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// With VITE_SUPABASE_URL=/ the browser reaches the local Supabase through this dev server,
// so phones on the same network only need the app port (see scripts/dev-lan.mjs).
const supabaseTarget = process.env.SUPABASE_PROXY_TARGET ?? 'http://127.0.0.1:54321';
const supabaseProxy = Object.fromEntries(['/auth/v1', '/rest/v1', '/storage/v1', '/functions/v1', '/realtime/v1']
  .map((path) => [path, { target: supabaseTarget, ws: path === '/realtime/v1' }]));

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', proxy: supabaseProxy },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
