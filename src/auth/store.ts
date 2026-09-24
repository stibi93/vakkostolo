import { isAuthApiError } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AuthCallback } from './callback';

type AuthApi = Pick<SupabaseClient['auth'], 'getSession' | 'getUser' | 'onAuthStateChange' |
  'exchangeCodeForSession' | 'signInWithOAuth' | 'signInWithPassword' | 'signOut'>;
export type AssuranceLevel = 'aal1' | 'aal2';
export interface AuthState {
  status: 'loading' | 'ready' | 'error';
  user: User | null;
  /** From the access token, for the UI only; host RPCs check aal2 on the server. */
  aal?: AssuranceLevel | null;
  pending: 'sign-in' | 'sign-out' | null;
  message: string | null;
}

const connectionMessage = 'Nem sikerült ellenőrizni a belépést. Ellenőrizd a kapcsolatot, majd próbáld újra.';
const callbackMessage = 'A belépés nem fejeződött be, vagy a hivatkozás lejárt. Indíts új belépést ugyanebben a böngészőben.';
const sessionEndedMessage = 'A belépésed lejárt vagy megszűnt. Lépj be újra.';
const revalidateAfterMs = 30_000;

export function readAssuranceLevel(accessToken: string): AssuranceLevel | null {
  try {
    const payload: unknown = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const aal = typeof payload === 'object' && payload !== null && 'aal' in payload ? payload.aal : null;
    return aal === 'aal1' || aal === 'aal2' ? aal : null;
  } catch {
    return null;
  }
}

async function withTimeout<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Auth timeout')), 15_000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Owns session transitions outside React so remounts cannot redeem a code twice. */
export function createAuthStore(auth: AuthApi, callback: AuthCallback | null, redirectTo: string,
  redirect: (url: string) => void) {
  let state: AuthState = { status: 'loading', user: null, pending: null, message: null };
  const listeners = new Set<() => void>();
  let revision = 0;
  let started: Promise<void> | undefined;
  let booting = true;
  let unsubscribe: (() => void) | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let verifiedAt = 0;

  function publish(next: AuthState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  async function refresh() {
    const request = ++revision;
    publish({ status: 'loading', user: null, pending: null, message: null });
    try {
      const { data, error } = await withTimeout(auth.getSession());
      if (request !== revision) return;
      if (error) throw error;
      if (!data.session) {
        verifiedAt = Date.now();
        publish({ status: 'ready', user: null, pending: null, message: null });
        return;
      }
      // Never use locally stored user metadata to decide the host UI state.
      const verified = await withTimeout(auth.getUser(data.session.access_token));
      if (request !== revision) return;
      if (verified.error || !verified.data.user) throw verified.error;
      verifiedAt = Date.now();
      publish({ status: 'ready', user: verified.data.user, aal: readAssuranceLevel(data.session.access_token),
        pending: null, message: null });
    } catch {
      if (request === revision) publish({ status: 'error', user: null, pending: null, message: connectionMessage });
    }
  }

  /** Background check: keeps the rendered host UI (and unsaved input) unless the session truly ended. */
  async function revalidate(force: boolean) {
    if (booting || state.pending || state.status === 'loading') return;
    if (state.status === 'error') return refresh();
    if (!force && Date.now() - verifiedAt < revalidateAfterMs) return;
    const request = ++revision;
    try {
      const { data, error } = await withTimeout(auth.getSession());
      if (request !== revision) return;
      if (error) throw error;
      if (!data.session) {
        verifiedAt = Date.now();
        if (state.user) publish({ status: 'ready', user: null, pending: null, message: sessionEndedMessage });
        return;
      }
      const verified = await withTimeout(auth.getUser(data.session.access_token));
      if (request !== revision) return;
      if (verified.error || !verified.data.user) throw verified.error;
      verifiedAt = Date.now();
      publish({ status: 'ready', user: verified.data.user, aal: readAssuranceLevel(data.session.access_token),
        pending: null, message: null });
    } catch (error) {
      if (request !== revision) return;
      if (isAuthApiError(error) && (error.status === 401 || error.status === 403)) {
        publish({ status: 'ready', user: null, pending: null, message: sessionEndedMessage });
      }
      // Network failures keep the last verified user; the next focus or online event retries.
    }
  }

  function start() {
    if (started) return started;
    const { data } = auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') {
        ++revision;
        clearTimeout(refreshTimer);
        publish({ status: 'ready', user: null, pending: null, message: null });
      } else if (!booting && state.pending !== 'sign-out') {
        // Do not call Auth methods while the SDK's event callback holds its lock.
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => { void (state.status === 'loading' ? refresh() : revalidate(true)); }, 0);
      }
    });
    unsubscribe = () => data.subscription.unsubscribe();
    const initialRevision = revision;
    started = (async () => {
      try {
        if (callback) {
          if (callback.failed || !callback.code) throw new Error('Invalid callback');
          const { error } = await withTimeout(auth.exchangeCodeForSession(callback.code,
            callback.flowId ? { flowId: callback.flowId } : undefined));
          if (initialRevision !== revision) return;
          if (error) throw error;
        }
        await refresh();
      } catch {
        if (initialRevision === revision) {
          publish({ status: 'error', user: null, pending: null, message: callbackMessage });
        }
      } finally {
        booting = false;
      }
    })();
    return started;
  }

  /** Players only; the host area uses the superadmin password below. */
  async function signInWithGoogle() {
    if (state.pending || state.status === 'loading' || (state.user && !state.user.is_anonymous)) return;
    ++revision;
    publish({ ...state, pending: 'sign-in', message: null });
    try {
      const { data, error } = await withTimeout(auth.signInWithOAuth({
        provider: 'google', options: { redirectTo, skipBrowserRedirect: true },
      }));
      if (error || !data.url) throw error;
      redirect(data.url);
    } catch {
      publish({ ...state, pending: null, message: 'Nem sikerült elindítani a Google-belépést. Próbáld újra.' });
    }
  }

  async function signInWithPassword(email: string, password: string) {
    if (state.pending || state.status === 'loading' || state.user) return;
    ++revision;
    publish({ ...state, pending: 'sign-in', message: null });
    try {
      const { error } = await withTimeout(auth.signInWithPassword({ email, password }));
      if (error) throw error;
      await refresh();
    } catch (error) {
      const message = isAuthApiError(error) && error.status === 429
        ? 'Túl sok belépési kísérlet. Várj néhány percet, majd próbáld újra.'
        : isAuthApiError(error) && error.status === 400
          ? 'Hibás felhasználónév vagy jelszó.'
          : 'A belépés nem sikerült. Ellenőrizd a kapcsolatot, majd próbáld újra.';
      publish({ status: 'ready', user: null, pending: null, message });
    }
  }

  async function signOut() {
    if (state.pending || state.status === 'loading') return;
    ++revision;
    clearTimeout(refreshTimer);
    publish({ ...state, pending: 'sign-out', message: null });
    try {
      const { error } = await withTimeout(auth.signOut({ scope: 'local' }));
      if (error) throw error;
      publish({ status: 'ready', user: null, pending: null, message: null });
    } catch {
      // Some SDK failures still clear local storage and emit SIGNED_OUT.
      publish({ ...state, pending: null, message: state.status === 'ready' && !state.user
        ? 'Ebből a böngészőből kiléptél, de a szerver nem igazolta vissza a kijelentkezést.'
        : 'A kijelentkezés nem sikerült. Ellenőrizd a kapcsolatot, majd próbáld újra.' });
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start,
    refresh: () => !booting && !state.pending ? refresh() : Promise.resolve(),
    revalidate: () => revalidate(false),
    /** After a second factor is verified: the new aal2 token must replace the rendered state. */
    reload: () => revalidate(true),
    signInWithGoogle,
    signInWithPassword,
    signOut,
    dispose() { ++revision; clearTimeout(refreshTimer); unsubscribe?.(); listeners.clear(); },
  };
}
