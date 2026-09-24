import { AuthApiError, AuthError } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPublicAppOrigin, readSupabaseConfig } from '../src/lib/config';
import { readAuthCallback } from '../src/auth/callback';
import { createAuthStore, readAssuranceLevel } from '../src/auth/store';
import { authSession, authUser } from './fixtures/auth';

type Auth = SupabaseClient['auth'];
const stores: ReturnType<typeof createAuthStore>[] = [];
function setup(callback: Parameters<typeof createAuthStore>[1] = null) {
  let notify: Parameters<Auth['onAuthStateChange']>[0] = async () => {};
  const auth = {
    getSession: vi.fn<Auth['getSession']>().mockResolvedValue({ data: { session: authSession() }, error: null }),
    getUser: vi.fn<Auth['getUser']>().mockResolvedValue({ data: { user: authUser }, error: null }),
    exchangeCodeForSession: vi.fn<Auth['exchangeCodeForSession']>().mockResolvedValue({
      data: { session: authSession(), user: authUser }, error: null,
    }),
    signInWithOAuth: vi.fn<Auth['signInWithOAuth']>().mockResolvedValue({
      data: { provider: 'google', url: 'https://auth.example.test/auth/v1/authorize' }, error: null,
    }),
    signInWithPassword: vi.fn<Auth['signInWithPassword']>().mockResolvedValue({
      data: { session: authSession(), user: authUser }, error: null,
    } as Awaited<ReturnType<Auth['signInWithPassword']>>),
    signOut: vi.fn<Auth['signOut']>().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn<Auth['onAuthStateChange']>().mockImplementation((callback) => {
      notify = callback;
      return { data: { subscription: { id: 'test', callback, unsubscribe: vi.fn() } } };
    }),
  };
  const redirect = vi.fn();
  const store = createAuthStore(auth, callback, 'https://app.example.test/auth/callback', redirect);
  stores.push(store);
  return { auth, store, redirect, notify: (...args: Parameters<typeof notify>) => notify(...args) };
}

afterEach(() => { stores.splice(0).forEach((store) => store.dispose()); vi.useRealTimers(); });

describe('publikus konfiguráció', () => {
  it('elkülöníti a hiányzó és hiányos beállítást', () => {
    expect(readSupabaseConfig()).toEqual({ status: 'missing' });
    expect(readSupabaseConfig('https://example.supabase.co')).toEqual({ status: 'invalid' });
  });
  it('HTTPS projektet és HTTP loopback fejlesztést fogad el', () => {
    expect(readSupabaseConfig('https://example.supabase.co/', 'sb_publishable_fixture').status).toBe('ready');
    expect(readSupabaseConfig('http://127.0.0.1:54321', 'sb_publishable_fixture').status).toBe('ready');
  });
  it.each(['http://remote.test', 'https://user:pass@remote.test', 'https://remote.test/path', 'https://remote.test/?key=1', 'javascript:alert(1)'])(
    'hibás vagy nem biztonságos URL-t elutasít: %s', (url) => {
      expect(readSupabaseConfig(url, 'sb_publishable_fixture').status).toBe('invalid');
    });
  it('relatív címet csak megadott originnel old fel (fejlesztői proxy)', () => {
    expect(readSupabaseConfig('/', 'sb_publishable_fixture')).toEqual({ status: 'invalid' });
    expect(readSupabaseConfig('/', 'sb_publishable_fixture', { origin: 'http://127.0.0.1:5173' }))
      .toEqual({ status: 'ready', config: { url: 'http://127.0.0.1:5173', key: 'sb_publishable_fixture' } });
    expect(readSupabaseConfig('/', 'sb_publishable_fixture', { origin: 'https://vakkostolo.test' }).status).toBe('ready');
  });
  it('HTTP-t privát LAN-címre csak fejlesztői engedéllyel fogad el', () => {
    const lan = { origin: 'http://192.168.1.73:5173' };
    expect(readSupabaseConfig('/', 'sb_publishable_fixture', lan).status).toBe('invalid');
    expect(readSupabaseConfig('/', 'sb_publishable_fixture', { ...lan, allowLanHttp: true }).status).toBe('ready');
    for (const origin of ['http://10.0.0.5:5173', 'http://172.20.1.1:5173']) {
      expect(readSupabaseConfig('/', 'sb_publishable_fixture', { origin, allowLanHttp: true }).status).toBe('ready');
    }
    for (const origin of ['http://8.8.8.8:5173', 'http://172.32.0.1:5173', 'http://192.168.1.73.evil.test']) {
      expect(readSupabaseConfig('/', 'sb_publishable_fixture', { origin, allowLanHttp: true }).status).toBe('invalid');
    }
  });
  it('a meghívó originje a megadott publikus címre vált, hibás értéknél marad az oldalé', () => {
    const page = 'http://127.0.0.1:5173';
    expect(readPublicAppOrigin(undefined, page)).toBe(page);
    expect(readPublicAppOrigin('http://192.168.1.73:5173/', page)).toBe('http://192.168.1.73:5173');
    for (const value of ['', 'nem url', 'javascript:alert(1)', 'http://user:pass@lan.test']) {
      expect(readPublicAppOrigin(value, page)).toBe(page);
    }
  });
  it('anon JWT-t elfogad, privilegizált és hibás kulcsot elutasít', () => {
    const jwt = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`;
    expect(readSupabaseConfig('https://example.test', jwt('anon')).status).toBe('ready');
    for (const key of [jwt('service_role'), 'sb_secret_fixture', 'broken', 'a.b.c']) {
      expect(readSupabaseConfig('https://example.test', key).status).toBe('invalid');
    }
  });
});

describe('munkamenet és OAuth', () => {
  it('a szerver felhasználóját használja a tárolt hostadat helyett', async () => {
    const { auth, store } = setup();
    auth.getUser.mockResolvedValue({ data: { user: { ...authUser, is_anonymous: true } }, error: null });
    await store.start();
    expect(auth.getUser).toHaveBeenCalledWith(authSession().access_token);
    expect(store.getSnapshot().user?.is_anonymous).toBe(true);
  });
  it('kijelentkezett állapotban nem kér felhasználói adatot', async () => {
    const { auth, store } = setup();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await store.start();
    expect(store.getSnapshot()).toMatchObject({ status: 'ready', user: null });
    expect(auth.getUser).not.toHaveBeenCalled();
  });
  it('ismételt indításnál is csak egyszer váltja be az OAuth-kódot', async () => {
    const { auth, store } = setup({ code: 'fixture-code', failed: false, flowId: 'fixture-flow' });
    await Promise.all([store.start(), store.start()]);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith('fixture-code', { flowId: 'fixture-flow' });
    expect(store.getSnapshot().user).toEqual(authUser);
  });
  it.each([{ code: null, failed: false }, { code: 'fixture-code', failed: true }])('hiányzó/megszakított callback nem nyit hostfelületet', async (callback) => {
    const { auth, store } = setup(callback);
    await store.start();
    expect(store.getSnapshot()).toMatchObject({ status: 'error', user: null });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('lejárt kódnál új belépést kér', async () => {
    const { auth, store } = setup({ code: 'expired', failed: false });
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null }, error: new AuthError('expired'),
    });
    await store.start();
    expect(store.getSnapshot().message).toContain('Indíts új belépést');
    expect(auth.getUser).not.toHaveBeenCalled();
  });
  it('sikertelen ellenőrzés után újrapróbálható', async () => {
    const { auth, store } = setup();
    auth.getUser.mockRejectedValueOnce(new Error('offline'));
    await store.start();
    expect(store.getSnapshot()).toMatchObject({ status: 'error', user: null });
    await store.refresh();
    expect(store.getSnapshot()).toMatchObject({ status: 'ready', user: authUser });
  });
  it('a függő kérés időkorlátot kap, a késői válasz nem nyit hostfelületet', async () => {
    vi.useFakeTimers();
    const { auth, store } = setup();
    let resolve!: (value: Awaited<ReturnType<Auth['getUser']>>) => void;
    auth.getUser.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const loading = store.start();
    await vi.advanceTimersByTimeAsync(15_001);
    await loading;
    expect(store.getSnapshot().status).toBe('error');
    resolve({ data: { user: authUser }, error: null });
    await Promise.resolve();
    expect(store.getSnapshot().status).toBe('error');
  });
  it('a kijelentkezési eseményt nem írja felül korábbi szerverválasz', async () => {
    const { auth, store, notify } = setup();
    let resolve!: (value: Awaited<ReturnType<Auth['getUser']>>) => void;
    auth.getUser.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const loading = store.start();
    await vi.waitFor(() => expect(auth.getUser).toHaveBeenCalled());
    await notify('SIGNED_OUT', null);
    resolve({ data: { user: authUser }, error: null });
    await loading;
    expect(store.getSnapshot()).toMatchObject({ status: 'ready', user: null });
  });
  it('a (játékosi) Google-belépés rögzített callbacket használ és nem indítható duplán', async () => {
    const { auth, store, redirect } = setup();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await store.start();
    await Promise.all([store.signInWithGoogle(), store.signInWithGoogle()]);
    expect(auth.signInWithOAuth).toHaveBeenCalledExactlyOnceWith({
      provider: 'google', options: { redirectTo: 'https://app.example.test/auth/callback', skipBrowserRedirect: true },
    });
    expect(redirect).toHaveBeenCalledExactlyOnceWith('https://auth.example.test/auth/v1/authorize');
  });
  it('superadmin jelszavas belépés: szerverrel igazolt felhasználó és aal a tokenből', async () => {
    const { auth, store } = setup();
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await store.start();
    auth.getSession.mockResolvedValue({ data: { session: authSession(authUser, 'aal1') }, error: null });
    await Promise.all([store.signInWithPassword('admin@superadmin.vakkostolo.invalid', 'Titkos-Jelszo-2026'),
      store.signInWithPassword('admin@superadmin.vakkostolo.invalid', 'Titkos-Jelszo-2026')]);
    expect(auth.signInWithPassword).toHaveBeenCalledExactlyOnceWith({
      email: 'admin@superadmin.vakkostolo.invalid', password: 'Titkos-Jelszo-2026' });
    expect(store.getSnapshot()).toMatchObject({ status: 'ready', user: { id: authUser.id }, aal: 'aal1', pending: null });
  });
  it('hibás jelszónál és túl sok próbálkozásnál magyar üzenet, munkamenet nélkül', async () => {
    const { auth, store } = setup();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await store.start();
    for (const [status, text] of [[400, 'Hibás felhasználónév vagy jelszó.'], [429, 'Túl sok belépési kísérlet']] as const) {
      auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null, session: null },
        error: new AuthApiError('fixture', status, 'invalid_credentials') } as Awaited<ReturnType<Auth['signInWithPassword']>>);
      await store.signInWithPassword('admin@superadmin.vakkostolo.invalid', 'rossz');
      expect(store.getSnapshot()).toMatchObject({ status: 'ready', user: null, pending: null });
      expect(store.getSnapshot().message).toContain(text);
    }
  });
  it('az aal szintet csak érvényes JWT-alakú tokenből olvassa', () => {
    expect(readAssuranceLevel(authSession(authUser, 'aal2').access_token)).toBe('aal2');
    expect(readAssuranceLevel(authSession(authUser, 'aal1').access_token)).toBe('aal1');
    for (const token of ['synthetic', 'a.b.c', `x.${btoa('{"aal":"aal9"}')}.y`]) expect(readAssuranceLevel(token)).toBeNull();
  });
  it('callback közben érkező kijelentkezést sem ír felül a késői kódbeváltás', async () => {
    const { auth, store, notify } = setup({ code: 'fixture-code', failed: false });
    let resolve!: (value: Awaited<ReturnType<Auth['exchangeCodeForSession']>>) => void;
    auth.exchangeCodeForSession.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const loading = store.start();
    await notify('SIGNED_OUT', null);
    resolve({ data: { session: authSession(), user: authUser }, error: null });
    await loading;
    expect(store.getSnapshot()).toMatchObject({ status: 'ready', user: null });
    expect(auth.getUser).not.toHaveBeenCalled();
  });
  it('a kijelentkezés csak az aktuális munkamenetre vonatkozik', async () => {
    const { auth, store } = setup();
    await store.start();
    await store.signOut();
    expect(auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
    expect(store.getSnapshot().user).toBeNull();
  });
  it('sikertelen kijelentkezés nem állít hamis sikert', async () => {
    const { auth, store } = setup();
    await store.start();
    auth.signOut.mockResolvedValue({ error: new AuthError('offline') });
    await store.signOut();
    expect(store.getSnapshot().user).toEqual(authUser);
    expect(store.getSnapshot().message).toContain('nem sikerült');
  });
  it('ha az SDK hiba mellett törölte a helyi munkamenetet, nem állítja vissza', async () => {
    const { auth, store, notify } = setup();
    await store.start();
    auth.signOut.mockImplementation(async () => {
      await notify('SIGNED_OUT', null);
      return { error: new AuthError('offline') };
    });
    await store.signOut();
    expect(store.getSnapshot().user).toBeNull();
    expect(store.getSnapshot().message).toContain('szerver nem igazolta');
  });
});

describe('callback paraméterek', () => {
  it('csak az Auth útvonalon értelmez kódot', () => {
    expect(readAuthCallback(new URL('https://app.test/host?code=fixture'))).toBeNull();
    expect(readAuthCallback(new URL('https://app.test/auth/callback?code=fixture&next=https://evil.test')))
      .toMatchObject({ code: 'fixture', failed: false });
  });
  it('fragmentben kapott szolgáltatói hibát is felismer', () => {
    expect(readAuthCallback(new URL('https://app.test/auth/callback#error=access_denied'))?.failed).toBe(true);
  });
});
