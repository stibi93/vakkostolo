import type { Factor, Session, User } from '@supabase/supabase-js';

// Synthetic fixtures only. No real account, credentials or player data.
const totpFactor: Factor = {
  id: '90000000-0000-0000-0000-000000000001', friendly_name: 'Vakkóstoló', factor_type: 'totp',
  status: 'verified', created_at: '2026-09-24T00:00:00Z', updated_at: '2026-09-24T00:00:00Z',
};
export const authUser: User = {
  id: '00000000-0000-0000-0000-000000000001',
  aud: 'authenticated', role: 'authenticated', email: 'admin@superadmin.vakkostolo.invalid',
  app_metadata: { provider: 'email', providers: ['email'], vakkostolo_role: 'superadmin' },
  user_metadata: { username: 'admin' }, factors: [totpFactor],
  created_at: '2026-09-24T00:00:00Z', is_anonymous: false,
};
export const googlePlayer: User = {
  id: '00000000-0000-0000-0000-000000000005',
  aud: 'authenticated', role: 'authenticated', email: 'player@example.test',
  app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: 'Kóstoló Kata' },
  created_at: '2026-09-24T00:00:00Z', is_anonymous: false,
};

const base64url = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** Unsigned, JWT-shaped token: the SDK and UI read `aal` from it; servers are always mocked. */
export function syntheticAccessToken(user: User, aal: 'aal1' | 'aal2') {
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub: user.id, role: 'authenticated', aal,
    exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic`;
}
export function authSession(user = authUser, aal: 'aal1' | 'aal2' = user === authUser ? 'aal2' : 'aal1'): Session {
  return {
    access_token: syntheticAccessToken(user, aal), refresh_token: 'synthetic-refresh-token',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer', user,
  };
}
