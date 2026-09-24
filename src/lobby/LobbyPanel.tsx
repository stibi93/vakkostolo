import { useEffect, useState, useSyncExternalStore } from 'react';
import { gameStatusLabels } from '../games/model';
import type { LobbyApi } from './model';
import { createLobbyStore } from './store';
import './lobby.css';

export function LobbyPanel({ api, gameId, showTitle = true }: { api: LobbyApi; gameId: string; showTitle?: boolean }) {
  const [store] = useState(() => createLobbyStore(api, gameId));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    store.setOnline(navigator.onLine);
    store.start();
    const refresh = () => { if (document.visibilityState === 'visible') void store.refresh(); };
    const online = () => store.setOnline(true);
    const offline = () => store.setOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
      store.dispose();
    };
  }, [store]);
  const snapshot = state.snapshot;
  const self = snapshot?.participants.find((participant) => participant.id === snapshot.selfParticipantId);
  const connection = state.connection === 'offline' ? 'Nincs hálózati kapcsolat.'
    : state.stale ? 'A legutóbbi frissítés nem sikerült.'
    : state.connection === 'live' ? 'Élő kapcsolat.'
    : 'Időszakos frissítés: 15 másodpercenként.';
  return <section className="lobby-panel" aria-label="Közös váró">
    {snapshot && <>
      {showTitle && <h2>{snapshot.game.title}</h2>}
      <p>{gameStatusLabels[snapshot.game.status]}</p>
      {self && <p className="lobby-membership">Bent vagy a váróban <strong>{self.nickname}</strong> néven.
        Saját jelölésed: <strong>#{String(self.seat).padStart(2, '0')}</strong>.</p>}
      <p>{snapshot.game.status === 'lobby' ? 'A játékmester indítja az első bort.'
        : snapshot.game.status === 'finished' ? 'A kóstoló befejeződött.'
        : snapshot.game.status === 'draft' ? 'A játékmester még előkészíti a kóstolót.' : 'A kóstoló már folyamatban van.'}</p>
    </>}
    <p className="lobby-connection" role="status">{!snapshot && state.loading ? 'A váró betöltése…' : connection}
      {snapshot && state.stale && ' A lista a korábban betöltött állapotot mutatja.'}</p>
    {state.error && <p role="alert" className="auth-message">{state.error}</p>}
    {snapshot && <>
      <h3>Résztvevők ({snapshot.participants.length})</h3>
      {snapshot.participants.length ? <ol className="lobby-participants">
        {snapshot.participants.map((participant) => <li key={participant.id}>
          <span className="lobby-seat">#{String(participant.seat).padStart(2, '0')}</span>
          <span>{participant.nickname}{participant.id === snapshot.selfParticipantId && <strong className="lobby-self"> · Te</strong>}</span>
        </li>)}
      </ol> : <p>Még senki nem lépett be.</p>}
      <p className="small-note">A számok az azonos becenevű játékosokat is megkülönböztetik.
        A lista a belépett résztvevőket mutatja, nem az éppen online telefonokat.</p>
      {snapshot.role === 'player' && <p className="small-note">Ezt az oldalt újratöltve ugyanide térsz vissza.
        A kóstolólap és a kör indítása még fejlesztés alatt áll.</p>}
    </>}
    <button className="button-secondary" disabled={state.loading || state.connection === 'offline'}
      onClick={() => void store.refresh()}>{state.loading ? 'Frissítés…' : 'Váró frissítése'}</button>
  </section>;
}
