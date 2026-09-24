import { readSupabaseConfig } from '../lib/config';
import { createSupabaseClient } from '../lib/supabase';
import { readAuthCallback } from './callback';
import { createAuthStore } from './store';

const callback = readAuthCallback(new URL(window.location.href));
// Remove codes and provider error details even if configuration is unavailable.
if (callback) window.history.replaceState(window.history.state, '', window.location.pathname);
const config = readSupabaseConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

function createRuntime() {
  if (config.status !== 'ready') return { status: config.status } as const;
  try {
    const client = createSupabaseClient(config.config);
    const store = createAuthStore(client.auth, callback, `${window.location.origin}/auth/callback`,
      (url) => window.location.assign(url));
    return { status: 'ready', store } as const;
  } catch {
    return { status: 'invalid' } as const;
  }
}

// Lazy-loaded only by /host and /auth/callback; one client per browser tab.
export const authRuntime = createRuntime();
if (import.meta.hot) import.meta.hot.dispose(() => {
  if (authRuntime.status === 'ready') authRuntime.store.dispose();
});
