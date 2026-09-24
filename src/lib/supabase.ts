import { createClient } from '@supabase/supabase-js';
import type { SupabaseConfig } from './config';
import { createTimeoutFetch } from './fetch';

/** Created once by the Auth runtime; the demo never imports this module. */
export function createSupabaseClient({ url, key }: SupabaseConfig) {
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
      // The callback is exchanged explicitly once, including under StrictMode.
      detectSessionInUrl: false,
    },
    global: { fetch: createTimeoutFetch(10_000) },
  });
}
