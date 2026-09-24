export type SupabaseConfig = { url: string; key: string };
export type ConfigResult =
  | { status: 'ready'; config: SupabaseConfig }
  | { status: 'missing' | 'invalid' };

/** VITE values are public. This check cannot make a bundled secret private. */
export function readSupabaseConfig(urlValue?: string, keyValue?: string): ConfigResult {
  const url = urlValue?.trim();
  const key = keyValue?.trim();
  if (!url && !key) return { status: 'missing' };
  if (!url || !key) return { status: 'invalid' };
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) ||
      parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
      return { status: 'invalid' };
    }
    let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
    // Legacy anon JWTs are supported; privileged JWTs and sb_secret keys are rejected.
    if (!publicKey && key.split('.').length === 3) {
      const payload: unknown = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      publicKey = typeof payload === 'object' && payload !== null && 'role' in payload && payload.role === 'anon';
    }
    return publicKey ? { status: 'ready', config: { url: parsed.origin, key } } : { status: 'invalid' };
  } catch {
    return { status: 'invalid' };
  }
}
