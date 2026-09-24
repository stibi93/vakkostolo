import { useEffect, useSyncExternalStore } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { PageFrame } from '../app/PageFrame';
import { HostWorkspace } from '../games/HostWorkspace';
import type { LiveApi } from '../live/model';
import type { GamesApi } from '../games/model';
import type { InvitesApi } from '../invites/model';
import { authRuntime } from './runtime';
import type { createAuthStore } from './store';

export function HostArea() {
  return (
    <PageFrame>
      <section className="auth-panel" aria-labelledby="host-title">
        <p className="eyebrow">ONLINE BELÉPÉS</p>
        <h1 id="host-title">Játékmester</h1>
        {authRuntime.status === 'ready' ? <HostSession store={authRuntime.store} games={authRuntime.games}
          invites={authRuntime.invites} lobby={authRuntime.lobby} /> : <>
          <h2>A belépés még nem elérhető.</h2>
          <p>{authRuntime.status === 'missing'
            ? 'Az online kapcsolat még nincs beállítva. Addig a próbakóstolóban végigjárhatod a játék menetét.'
            : 'Az online kapcsolat beállítása hibás. A belépéshez az üzemeltető segítsége szükséges.'}</p>
          <Link className="button-secondary" to="/demo">Próbakóstoló megnyitása</Link>
        </>}
      </section>
    </PageFrame>
  );
}

function HostSession({ store, games, invites, lobby }: {
  store: ReturnType<typeof createAuthStore>; games: GamesApi; invites: InvitesApi; lobby: LiveApi;
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

  if (state.status === 'loading') return <p role="status">Belépés ellenőrzése…</p>;
  if (location.pathname.replace(/\/+$/, '') === '/auth/callback' && state.status === 'ready') {
    return <Navigate to="/host" replace />;
  }

  return <>
    {state.message && <p className="auth-message" role="alert">{state.message}</p>}
    {state.status === 'error' ? <>
      <h2>Nem sikerült ellenőrizni a belépést.</h2>
      <div className="actions">
        <button className="button-primary" disabled={!!state.pending} onClick={() => void store.refresh()}>Újrapróbálás</button>
        <button className="button-secondary" disabled={!!state.pending} onClick={() => void store.signIn()}>Új Google-belépés</button>
        <button className="button-secondary" disabled={!!state.pending} onClick={() => void store.signOut()}>Kijelentkezés</button>
      </div>
    </> : state.user ? <>
      {state.user.is_anonymous === false ? <>
        <h2>Játékmesteri fiók</h2>
        <p>Bejelentkezve{state.user.email ? `: ${state.user.email}` : '.'}</p>
        <HostWorkspace key={state.user.id} api={games} invites={invites} lobby={lobby} />
      </> : <>
        <h2>Most vendégként vagy belépve.</h2>
        <p>Játékmesterként tartós fiókra van szükséged. Előbb jelentkezz ki, majd lépj be Google-fiókkal.</p>
        <p>A kijelentkezéssel a böngészőben tárolt vendégbelépés megszűnik.</p>
      </>}
      <div className="actions"><button className="button-secondary" disabled={!!state.pending}
        onClick={() => void store.signOut()}>{state.pending === 'sign-out' ? 'Kijelentkezés…' : 'Kijelentkezés'}</button></div>
    </> : <>
      <h2>Játékmesteri belépés</h2>
      <p>Lépj be Google-fiókkal. A játékosoknak később elég lesz a meghívód és egy becenév.</p>
      <button className="button-primary" disabled={!!state.pending} onClick={() => void store.signIn()}>
        {state.pending === 'sign-in' ? 'Átirányítás a Google-belépéshez…' : 'Belépés Google-fiókkal'}
      </button>
      <p className="small-note">A közös online játék még készül. A belépés már a beállított online fiókhoz kapcsolódik.</p>
    </>}
  </>;
}
