import { createClient } from '@supabase/supabase-js';
import type { SupabaseConfig } from './config';

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
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(init?.signal ? [init.signal] : [])]),
      }),
    },
  });
}
