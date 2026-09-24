export type SupabaseConfig = { url: string; key: string };
export type ConfigResult =
  | { status: 'ready'; config: SupabaseConfig }
  | { status: 'missing' | 'invalid' };
export type ConfigOptions = {
  /** Resolves a relative URL such as `/` (dev server proxy) against the page origin. */
  origin?: string;
  /** Development only: plain HTTP to a private LAN address for same-network testing. */
  allowLanHttp?: boolean;
};

const loopbackHosts = ['localhost', '127.0.0.1', '[::1]'];
const privateIpv4 = /^(10\.\d{1,3}|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}$/;

/** VITE values are public. This check cannot make a bundled secret private. */
export function readSupabaseConfig(urlValue?: string, keyValue?: string, options: ConfigOptions = {}): ConfigResult {
  const url = urlValue?.trim();
  const key = keyValue?.trim();
  if (!url && !key) return { status: 'missing' };
  if (!url || !key) return { status: 'invalid' };
  try {
    if (!options.origin && !/^[a-z][a-z0-9+.-]*:/i.test(url)) return { status: 'invalid' };
    const parsed = new URL(url, options.origin);
    const plainHttpAllowed = loopbackHosts.includes(parsed.hostname) ||
      (options.allowLanHttp === true && privateIpv4.test(parsed.hostname));
    if ((parsed.protocol !== 'https:' && !(plainHttpAllowed && parsed.protocol === 'http:')) ||
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

/** Origin used in invite links; `VITE_PUBLIC_APP_URL` lets a 127.0.0.1 host share a LAN-reachable link. */
export function readPublicAppOrigin(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return fallback;
    return parsed.origin;
  } catch {
    return fallback;
  }
}
