import { AuthApiError } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthStore } from '../src/auth/store';
import type { AuthState } from '../src/auth/store';
import { authSession, authUser } from './fixtures/auth';

type Auth = SupabaseClient['auth'];
const stores: ReturnType<typeof createAuthStore>[] = [];

async function startedStore() {
  let notify: Parameters<Auth['onAuthStateChange']>[0] = async () => {};
  const auth = {
    getSession: vi.fn<Auth['getSession']>().mockResolvedValue({ data: { session: authSession() }, error: null }),
    getUser: vi.fn<Auth['getUser']>().mockResolvedValue({ data: { user: authUser }, error: null }),
    exchangeCodeForSession: vi.fn<Auth['exchangeCodeForSession']>(),
    signInWithOAuth: vi.fn<Auth['signInWithOAuth']>(),
    signInWithPassword: vi.fn<Auth['signInWithPassword']>().mockResolvedValue({
      data: { session: authSession(), user: authUser }, error: null,
    } as Awaited<ReturnType<Auth['signInWithPassword']>>),
    signOut: vi.fn<Auth['signOut']>().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn<Auth['onAuthStateChange']>().mockImplementation((callback) => {
      notify = callback;
      return { data: { subscription: { id: 'test', callback, unsubscribe: vi.fn() } } };
    }),
  };
  const store = createAuthStore(auth, null, 'https://app.example.test/auth/callback', vi.fn());
  stores.push(store);
  await store.start();
  const published: AuthState[] = [];
  store.subscribe(() => published.push(store.getSnapshot()));
  return { auth, store, published, notify: (...args: Parameters<typeof notify>) => notify(...args) };
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); });
afterEach(() => { stores.splice(0).forEach((store) => store.dispose()); vi.useRealTimers(); });

describe('háttérbeli munkamenet-ellenőrzés', () => {
  it('visszatéréskor nem vált betöltésre, és megtartja a hostfelületet', async () => {
    const { auth, store, published } = await startedStore();
    vi.advanceTimersByTime(30_001);
    await store.revalidate();
    expect(auth.getUser).toHaveBeenCalledTimes(2);
    expect(published.map((state) => state.status)).not.toContain('loading');
    expect(store.getSnapshot()).toMatchObject({ status: 'ready', user: authUser });
  });
  it('gyakori fókuszváltásnál nem kérdez újra a szervertől', async () => {
    const { auth, store } = await startedStore();
    await store.revalidate();
    vi.advanceTimersByTime(10_000);
    await store.revalidate();
    expect(auth.getUser).toHaveBeenCalledTimes(1);
  });
  it('átmeneti hálózati hibánál nem lépteti ki a hostot', async () => {
    const { auth, store } = await startedStore();
    auth.getUser.mockRejectedValueOnce(new Error('offline'));
    vi.advanceTimersByTime(30_001);
    await store.revalidate();
    expect(store.getSnapshot()).toMatchObject({ status: 'ready', user: authUser, message: null });
  });
  it('érvénytelenné vált munkamenetnél új belépést kér', async () => {
    const { auth, store } = await startedStore();
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new AuthApiError('bad_jwt', 401, 'bad_jwt') });
    vi.advanceTimersByTime(30_001);
    await store.revalidate();
    expect(store.getSnapshot()).toMatchObject({ status: 'ready', user: null });
    expect(store.getSnapshot().message).toContain('Lépj be újra');
  });
  it('tokenfrissítés után sem üríti ki a felületet', async () => {
    const { auth, store, published, notify } = await startedStore();
    await notify('TOKEN_REFRESHED', authSession());
    await vi.advanceTimersByTimeAsync(0);
    expect(auth.getUser).toHaveBeenCalledTimes(2);
    expect(published.map((state) => state.status)).not.toContain('loading');
    expect(store.getSnapshot().user).toEqual(authUser);
  });
  it('hibaállapotból a háttéresemény is újrapróbál', async () => {
    const { auth, store } = await startedStore();
    auth.getUser.mockRejectedValueOnce(new Error('offline'));
    await store.refresh();
    expect(store.getSnapshot().status).toBe('error');
    await store.revalidate();
    expect(store.getSnapshot()).toMatchObject({ status: 'ready', user: authUser });
  });
});
