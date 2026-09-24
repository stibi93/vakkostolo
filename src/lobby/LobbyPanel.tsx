import type { ReactNode } from 'react';
import { gameStatusLabels } from '../games/model';
import type { LobbyApi } from './model';
import { useSnapshot } from './useSnapshot';
import type { LobbyState } from './store';
import './lobby.css';

export function LobbyPanel({ api, gameId, showTitle = true }: { api: LobbyApi; gameId: string; showTitle?: boolean }) {
  const { state, refresh } = useSnapshot(api, gameId);
  return <LobbyView state={state} refresh={refresh} showTitle={showTitle} />;
}

export function LobbyView({ state, refresh, showTitle = true, children, activeRound = false }: {
  state: LobbyState; refresh: () => Promise<void>; showTitle?: boolean; children?: ReactNode; activeRound?: boolean;
}) {
  const snapshot = state.snapshot;
  const self = snapshot?.participants.find((participant) => participant.id === snapshot.selfParticipantId);
  const connection = state.connection === 'offline' ? 'Nincs hálózati kapcsolat.'
    : state.stale ? 'A legutóbbi frissítés nem sikerült.'
    : state.connection === 'live' ? 'Élő kapcsolat.'
    : 'Időszakos frissítés: 15 másodpercenként.';
  return <section className="lobby-panel" aria-label={activeRound ? 'Élő kóstoló' : 'Közös váró'}>
    {snapshot && <>
      {showTitle && <h2>{snapshot.game.title}</h2>}
      {!activeRound && <p>{gameStatusLabels[snapshot.game.status]}</p>}
      {self && <p className="lobby-membership">{activeRound ? 'Játékos: ' : 'Bent vagy a váróban '}<strong>{self.nickname}</strong>{activeRound ? ' · ' : ' néven. Saját jelölésed: '} <strong>#{String(self.seat).padStart(2, '0')}</strong>.</p>}
      {!activeRound && <p>{snapshot.game.status === 'lobby' ? 'A játékmester indítja az első bort.'
        : snapshot.game.status === 'finished' ? 'A kóstoló befejeződött.'
        : snapshot.game.status === 'draft' ? 'A játékmester még előkészíti a kóstolót.' : 'A kóstoló már folyamatban van.'}</p>}
    </>}
    <p className="lobby-connection" role="status">{!snapshot && state.loading ? 'A váró betöltése…' : connection}
      {snapshot && state.stale && ' A lista a korábban betöltött állapotot mutatja.'}</p>
    {state.error && <p role="alert" className="auth-message">{state.error}</p>}
    {children}
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
        A mentett tippedet is visszakapod.</p>}
    </>}
    <button className="button-secondary" disabled={state.loading || state.connection === 'offline'}
      onClick={() => void refresh()}>{state.loading ? 'Frissítés…' : activeRound ? 'Kóstoló frissítése' : 'Váró frissítése'}</button>
  </section>;
}
