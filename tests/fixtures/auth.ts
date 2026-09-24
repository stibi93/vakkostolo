import type { Session, User } from '@supabase/supabase-js';

// Synthetic fixtures only. No real account, credentials or player data.
export const authUser: User = {
  id: '00000000-0000-0000-0000-000000000001',
  aud: 'authenticated', role: 'authenticated', email: 'host@example.test',
  app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: {},
  created_at: '2026-09-24T00:00:00Z', is_anonymous: false,
};
export function authSession(user = authUser): Session {
  return {
    access_token: 'synthetic-access-token', refresh_token: 'synthetic-refresh-token',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer', user,
  };
}
