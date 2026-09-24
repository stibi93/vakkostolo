import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router';
import { authRuntime } from '../auth/runtime';
import type { createAuthStore } from '../auth/store';
import { gameErrorMessage } from '../games/api';
import type { GamesApi } from '../games/model';
import { LiveGamePanel } from '../live/LiveGamePanel';
import type { LiveApi } from '../live/model';
import { QrCode } from './QrCode';
import { inviteUrl, publicAppOrigin, readStoredInvite } from './model';
import type { Invite } from './model';
import './invites.css';

/** Projector view: title, QR, link and nicknames only; wine data is never requested here. */
export function ProjectorPage() {
  const { gameId = '' } = useParams();
  return <div className="projector-shell">
    <main className="projector-main">
      {authRuntime.status === 'ready'
        ? <ProjectorSession store={authRuntime.store} games={authRuntime.games} lobby={authRuntime.lobby} gameId={gameId} />
        : <ProjectorNotice text="Az online kapcsolat nincs beállítva, ezért a kivetítő nem érhető el." />}
    </main>
  </div>;
}

function ProjectorNotice({ text }: { text: string }) {
  return <section className="projector-notice">
    <h1>Vakkóstoló</h1>
    <p>{text}</p>
    <Link className="button-secondary" to="/host">Játékmesteri oldal</Link>
  </section>;
}

function ProjectorSession({ store, games, lobby, gameId }: {
  store: ReturnType<typeof createAuthStore>; games: GamesApi; lobby: LiveApi; gameId: string;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => { void store.start(); }, [store]);
  if (state.status === 'loading') return <p role="status">Belépés ellenőrzése…</p>;
  if (state.status === 'error') return <ProjectorNotice text="Nem sikerült ellenőrizni a belépést. Frissítsd az oldalt." />;
  if (!state.user || state.user.is_anonymous !== false) {
    return <ProjectorNotice text="A kivetítőt abban a böngészőben nyisd meg, ahol játékmesterként beléptél." />;
  }
  return <ProjectorView key={`${state.user.id}:${gameId}`} games={games} lobby={lobby} gameId={gameId} />;
}

function useStoredInvite(gameId: string) {
  const [invite, setInvite] = useState<Invite | null>(() => readStoredInvite(window.localStorage, gameId));
  useEffect(() => {
    // Rotating the invite in the host tab updates the projector tab through the storage event.
    const sync = () => setInvite(readStoredInvite(window.localStorage, gameId));
    window.addEventListener('storage', sync);
    const timer = setInterval(sync, 60_000);
    return () => { window.removeEventListener('storage', sync); clearInterval(timer); };
  }, [gameId]);
  return invite;
}

function ProjectorView({ games, lobby, gameId }: { games: GamesApi; lobby: LiveApi; gameId: string }) {
  const invite = useStoredInvite(gameId);
  const [title, setTitle] = useState<{ status: 'loading' } | { status: 'ready'; value: string | null } |
    { status: 'error'; message: string }>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    games.list().then((list) => {
      if (active) setTitle({ status: 'ready', value: list.find((game) => game.id === gameId)?.title ?? null });
    }, (error: unknown) => { if (active) setTitle({ status: 'error', message: gameErrorMessage(error) }); });
    return () => { active = false; };
  }, [games, gameId]);

  if (title.status === 'loading') return <p role="status">A kivetítő betöltése…</p>;
  if (title.status === 'error') return <ProjectorNotice text={title.message} />;
  if (title.value === null) return <ProjectorNotice text="Ez a kóstoló nem található a saját kóstolóid között." />;
  if (!invite) {
    return <ProjectorNotice text="Ehhez a kóstolóhoz ebben a böngészőben nincs érvényes meghívó. Nyisd meg a váróját a játékmesteri oldalon." />;
  }
  const url = inviteUrl(publicAppOrigin(), invite.token);
  return <section className="projector-view" aria-labelledby="projector-title">
    <div className="projector-invite">
      <p className="eyebrow">VAKKÓSTOLÓ · KÓSTOLÓ</p>
      <h1 id="projector-title">{title.value}</h1>
      <p className="projector-lead">Olvasd be a QR-kódot a telefonod kamerájával, és adj meg egy becenevet.</p>
      <QrCode value={url} label="QR-kód a kóstolóba való belépéshez" />
      <p className="projector-link"><code>{url}</code></p>
    </div>
    <LiveGamePanel presentation api={lobby} gameId={gameId} showTitle={false} />
  </section>;
}
