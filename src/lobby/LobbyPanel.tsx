import type { ReactNode } from 'react';
import { gameStatusLabels } from '../games/model';
import type { LobbyApi } from './model';
import type { PresenceView } from './presence';
import { useSnapshot } from './useSnapshot';
import type { LobbyState } from './store';
import './lobby.css';

export function LobbyPanel({ api, gameId, showTitle = true }: { api: LobbyApi; gameId: string; showTitle?: boolean }) {
  const { state, refresh } = useSnapshot(api, gameId);
  return <LobbyView state={state} refresh={refresh} showTitle={showTitle} />;
}

const seatLabel = (seat: number) => String(seat).padStart(2, '0');

export function LobbyView({ state, refresh, showTitle = true, children, activeRound = false, presence = null }: {
  state: LobbyState; refresh: () => Promise<void>; showTitle?: boolean; children?: ReactNode; activeRound?: boolean;
  presence?: PresenceView | null;
}) {
  const snapshot = state.snapshot;
  const self = snapshot?.participants.find((participant) => participant.id === snapshot.selfParticipantId);
  const live = presence?.status === 'live';
  const onlineCount = live ? snapshot?.participants.filter((p) => presence.online.has(p.id)).length ?? 0 : 0;
  const connection = state.connection === 'offline' ? 'Nincs hálózati kapcsolat.'
    : state.stale ? 'A legutóbbi frissítés nem sikerült.'
    : state.connection === 'live' ? 'Élő kapcsolat.'
    : 'Időszakos frissítés: 15 másodpercenként.';
  const canRetry = (!!state.error || state.stale) && state.connection !== 'offline';
  return <section className="lobby-panel" aria-label={activeRound ? 'Élő kóstoló' : 'Közös váró'}>
    {snapshot && <header className="lobby-head">
      {showTitle && <h2>{snapshot.game.title}</h2>}
      {!activeRound && <p className="lobby-stage"><span className="lobby-stage-label">{gameStatusLabels[snapshot.game.status]}</span>
        {snapshot.game.status === 'lobby' ? 'A játékmester indítja az első bort.'
          : snapshot.game.status === 'finished' ? 'A kóstoló befejeződött.'
          : snapshot.game.status === 'draft' ? 'A játékmester még előkészíti a kóstolót.' : 'A kóstoló már folyamatban van.'}</p>}
      {self && <p className="lobby-membership">
        <span className="lobby-membership-seat" aria-hidden="true">{seatLabel(self.seat)}</span>
        <span>{activeRound ? 'Játékos: ' : 'Bent vagy a váróban '}<strong>{self.nickname}</strong>{activeRound ? ' · ' : ' néven. Saját jelölésed: '}
          <strong>#{seatLabel(self.seat)}</strong>.</span>
      </p>}
    </header>}
    <p className={`lobby-connection lobby-connection-${state.connection}`} role="status">
      {!snapshot && state.loading ? 'A váró betöltése…' : connection}
      {snapshot && state.stale && ' A lista a korábban betöltött állapotot mutatja.'}</p>
    {state.error && <p role="alert" className="auth-message">{state.error}</p>}
    {canRetry && <button className="button-secondary lobby-retry" disabled={state.loading} onClick={() => void refresh()}>
      {state.loading ? 'Újrapróbálás…' : 'Újrapróbálás'}</button>}
    {children}
    {snapshot && <section className="lobby-roster" aria-labelledby="lobby-roster-title">
      <div className="lobby-roster-head">
        <h3 id="lobby-roster-title">Résztvevők ({snapshot.participants.length})</h3>
        {live && snapshot.participants.length > 0 && <p className={`lobby-online-count${onlineCount ? '' : ' is-empty'}`}>
          <span className="lobby-pulse" aria-hidden="true" />{onlineCount} bent van most</p>}
      </div>
      {snapshot.participants.length ? <ol className="lobby-participants">
        {snapshot.participants.map((participant) => {
          const online = live && presence.online.has(participant.id);
          return <li key={participant.id} className={live ? (online ? 'is-online' : 'is-away') : undefined}>
            <span className="lobby-seat">#{seatLabel(participant.seat)}</span>
            <span className="lobby-name">{participant.nickname}{participant.id === snapshot.selfParticipantId && <strong className="lobby-self"> · Te</strong>}</span>
            {live && <span className="lobby-presence">{online ? 'bent van' : 'nincs bent'}</span>}
          </li>;
        })}
      </ol> : <p className="lobby-empty">Még senki nem lépett be.</p>}
      <p className="small-note">{live
        ? 'A lista magától frissül: látszik, ki van most bent, és ki zárta be az oldalt vagy vesztette el a kapcsolatot.'
        : presence?.status === 'unavailable'
          ? 'Az online jelenlét most nem látszik; a lista a belépett résztvevőket mutatja.'
          : 'A lista magától frissül.'} A számok az azonos becenevű játékosokat is megkülönböztetik.</p>
      {snapshot.role === 'player' && <p className="small-note">Ezt az oldalt újratöltve ugyanide térsz vissza.
        A mentett tippedet is visszakapod.</p>}
    </section>}
  </section>;
}
