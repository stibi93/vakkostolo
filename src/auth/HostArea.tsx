import { useEffect, useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { PageFrame } from '../app/PageFrame';
import { HostWorkspace } from '../games/HostWorkspace';
import type { LiveApi } from '../live/model';
import type { GamesApi } from '../games/model';
import type { InvitesApi } from '../invites/model';
import { MfaGate } from './MfaGate';
import type { MfaApi } from './mfa';
import { readReturnPath } from './return-path';
import { authRuntime } from './runtime';
import type { createAuthStore } from './store';
import { isSuperadmin, superadminEmail, usernameError, usernameFromEmail } from './superadmin-account';

export function HostArea() {
  return (
    <PageFrame>
      <section className="auth-panel" aria-labelledby="host-title">
        {authRuntime.status === 'ready' ? <HostSession store={authRuntime.store} mfa={authRuntime.mfa}
          games={authRuntime.games} invites={authRuntime.invites} lobby={authRuntime.lobby} /> : <>
          <p className="eyebrow">ONLINE BELÉPÉS</p>
          <h1 id="host-title">Játékmester</h1>
          <h2>A belépés még nem elérhető.</h2>
          <p>{authRuntime.status === 'missing'
            ? 'Az online kapcsolat még nincs beállítva. A belépéshez az üzemeltető állítja be a Supabase-kapcsolatot.'
            : 'Az online kapcsolat beállítása hibás. A belépéshez az üzemeltető segítsége szükséges.'}</p>
        </>}
      </section>
    </PageFrame>
  );
}

type Store = ReturnType<typeof createAuthStore>;

function HostSession({ store, mfa, games, invites, lobby }: {
  store: Store; mfa: MfaApi; games: GamesApi; invites: InvitesApi; lobby: LiveApi;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const location = useLocation();
  useEffect(() => {
    void store.start();
    const revalidate = () => { if (document.visibilityState === 'visible') void store.revalidate(); };
    window.addEventListener('online', revalidate);
    window.addEventListener('focus', revalidate);
    window.addEventListener('pageshow', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      window.removeEventListener('online', revalidate);
      window.removeEventListener('focus', revalidate);
      window.removeEventListener('pageshow', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
  }, [store]);

  if (state.status === 'loading') return <>
    <h1 id="host-title" className="host-title-quiet">Játékmester</h1>
    <p role="status">Belépés ellenőrzése…</p>
  </>;
  if (location.pathname.replace(/\/+$/, '') === '/auth/callback') {
    // Google sign-in belongs to players: send them back to their invite, even after a failed callback.
    const playerReturn = readReturnPath(window.sessionStorage);
    if (playerReturn) return <Navigate to={playerReturn} replace />;
    if (state.status === 'ready') return <Navigate to="/host" replace />;
  }
  const signOut = <div className="actions"><button className="button-secondary" disabled={!!state.pending}
    onClick={() => void store.signOut()}>{state.pending === 'sign-out' ? 'Kijelentkezés…' : 'Kijelentkezés'}</button></div>;
  const host = state.status === 'ready' && !!state.user && state.user.is_anonymous === false && isSuperadmin(state.user);

  return <>
    {!host && <p className="eyebrow">ONLINE BELÉPÉS</p>}
    <h1 id="host-title" className={host ? 'host-title-quiet' : undefined}>Játékmester</h1>
    {state.message && <p className="auth-message" role="alert">{state.message}</p>}
    {state.status === 'error' ? <>
      <h2>Nem sikerült ellenőrizni a belépést.</h2>
      <div className="actions">
        <button className="button-primary" disabled={!!state.pending} onClick={() => void store.refresh()}>Újrapróbálás</button>
        <button className="button-secondary" disabled={!!state.pending} onClick={() => void store.signOut()}>Kijelentkezés</button>
      </div>
    </> : !state.user ? <PasswordSignIn store={store} pending={state.pending === 'sign-in'} />
      : state.user.is_anonymous !== false ? <>
        <h2>Most vendégként vagy belépve.</h2>
        <p>A játékmesteri felülethez előbb jelentkezz ki, majd lépj be a superadmin felhasználóval.</p>
        <p>A kijelentkezéssel a böngészőben tárolt vendégbelépés megszűnik.</p>
        {signOut}
      </> : !isSuperadmin(state.user) ? <>
        <h2>Ez játékosfiók.</h2>
        <p>Játékosként vagy belépve{state.user.email ? ` (${state.user.email})` : ''}. Kóstolót csak a superadmin
          felhasználó vezethet. Jelentkezz ki, majd lépj be a superadmin felhasználónévvel és jelszóval.</p>
        {signOut}
      </> : <>
        <div className="host-account">
          <p>Bejelentkezve: {usernameFromEmail(state.user.email) ?? state.user.email}</p>
          {signOut}
        </div>
        <MfaGate key={state.user.id} mfa={mfa} aal={state.aal ?? null} onVerified={() => store.reload()}>
          <HostWorkspace key={state.user.id} api={games} invites={invites} lobby={lobby} />
        </MfaGate>
      </>}
  </>;
}

function PasswordSignIn({ store, pending }: { store: Store; pending: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = usernameError(username) ?? (password ? null : 'Add meg a jelszót.');
    setProblem(invalid);
    if (invalid) return;
    const secret = password;
    setPassword('');
    await store.signInWithPassword(superadminEmail(username), secret);
  }
  return <>
    {/* <h2>Játékmesteri belépés</h2> */}
    <p>A kóstolót a superadmin felhasználó vezeti. A játékosok a meghívó QR-kódjával lépnek be,
      nekik nem kell ez az oldal.</p>
    <form className="host-sign-in" onSubmit={(event) => void submit(event)} noValidate>
      <label htmlFor="host-username">Felhasználónév</label>
      <input id="host-username" name="username" value={username} onChange={(event) => setUsername(event.target.value)}
        autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      <label htmlFor="host-password">Jelszó</label>
      <input id="host-password" name="password" type="password" value={password}
        onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
      {problem && <p role="alert" className="auth-message">{problem}</p>}
      <button className="button-primary" type="submit" disabled={pending}>{pending ? 'Belépés…' : 'Belépés'}</button>
    </form>
    <p className="small-note">Elfelejtett jelszó vagy elveszett hitelesítő app esetén a gépen, ahol a Supabase
      titkos kulcsa elérhető: <code>npm run superadmin -- reset-password &lt;név&gt;</code> vagy <code>reset-mfa</code>.</p>
  </>;
}
