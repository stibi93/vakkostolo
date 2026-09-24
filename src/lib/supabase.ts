import { createClient } from '@supabase/supabase-js';

/** Integration seam; the demo deliberately never calls this factory. */
export function createSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('A Supabase publikus konfigurációja még nincs beállítva.');
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}
