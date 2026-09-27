import { useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { DeleteGameButton } from './DeleteGameButton';
import { ScheduleEditor } from '../schedule/ScheduleEditor';
import { CreateGamePage } from './CreateGamePage';
import { WinePhotoField } from './WinePhotoField';
import { gameErrorMessage } from './api';
import { gameStatusLabels } from './model';
import type { GameStatus } from '../domain/game';
import { LiveGamePanel } from '../live/LiveGamePanel';
import type { LiveApi } from '../live/model';
import { InvitePanel } from '../invites/InvitePanel';
import type { InvitesApi } from '../invites/model';
import type { GamesApi } from './model';
import './games.css';

type QueryState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };
function useGameQuery<T>(load: () => Promise<T>) {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    load().then((data) => { if (active) setState({ status: 'ready', data }); },
      (error: unknown) => { if (active) setState({ status: 'error', message: gameErrorMessage(error) }); });
    return () => { active = false; };
  }, [load, attempt]);
  const refresh = useCallback(() => setAttempt(value => value+1), []);
  return { state, refresh, retry: () => { setState({ status: 'loading' }); setAttempt((value) => value+1); } };
}

export function HostWorkspace({ api, invites, lobby }: { api: GamesApi; invites: InvitesApi; lobby: LiveApi }) {
  return <Routes>
    <Route index element={<HostGameList api={api} />} />
    <Route path="new" element={<CreateGamePage api={api} />} />
    <Route path=":gameId" element={<HostGameDetailsRoute api={api} invites={invites} lobby={lobby} />} />
  </Routes>;
}

function HostGameList({ api }: { api: GamesApi }) {
  const load = useCallback(() => api.list(), [api]);
  const { state, retry, refresh } = useGameQuery(load);
  const [notice, setNotice] = useState('');
  return <section className="game-section" aria-labelledby="my-games-title">
    <div className="host-page-head">
      <h2 id="my-games-title">Saját kóstolóim</h2>
      <Link className="button-primary" to="/host/new">Új kóstoló</Link>
    </div>
    {notice && <p role="status">{notice}</p>}
    {state.status === 'loading' && <p role="status">Kóstolók betöltése…</p>}
    {state.status === 'error' && <p role="alert" className="auth-message">{state.message}</p>}
    {state.status === 'ready' && (state.data.length ? <>
      <ul className="host-game-list">{state.data.map((game) => <li key={game.id}>
        <Link to={`/host/${game.id}`}>{game.title}</Link>
        <span>{gameStatusLabels[game.status]} · {new Date(game.createdAt).toLocaleDateString('hu-HU')}</span>
        <div className="host-game-actions">
          <Link className="button-secondary" to={`/host/new?from=${game.id}`}>Másolat alapján</Link>
          <DeleteGameButton api={api} id={game.id} title={game.title} onDeleted={() => { setNotice('A kóstoló törölve.'); refresh(); }} />
        </div>
      </li>)}</ul>
      {state.data.length === 100 && <p>A legutóbbi 100 kóstolót mutatjuk.</p>}
    </> : <p>Még nincs mentett kóstolód. Az elsőt az „Új kóstoló” gombbal hozhatod létre.</p>)}
    <button className="button-secondary" disabled={state.status === 'loading'} onClick={retry}>Lista frissítése</button>
  </section>;
}

function HostGameDetailsRoute({ api, invites, lobby }: { api: GamesApi; invites: InvitesApi; lobby: LiveApi }) {
  const { gameId = '' } = useParams();
  return <HostGameDetails key={gameId} api={api} invites={invites} lobby={lobby} gameId={gameId} />;
}

function HostGameDetails({ api, invites, lobby, gameId }: { api: GamesApi; invites: InvitesApi; lobby: LiveApi; gameId: string }) {
  const load = useCallback(() => api.get(gameId), [api, gameId]);
  const { state, retry, refresh } = useGameQuery(load);
  const [statusOverride, setStatusOverride] = useState<GameStatus | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  useEffect(() => { if (version !== null) refresh(); }, [version, refresh]);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { if (statusOverride !== null) refresh(); }, [statusOverride, refresh]);
  return <section className="game-section" aria-labelledby="saved-game-title">
    <nav className="host-subnav" aria-label="Játékmesteri navigáció">
      <Link className="button-secondary" to="/host">Saját kóstolóim</Link>
      <Link className="button-secondary" to="/host/new">Új kóstoló</Link>
      <Link className="button-secondary" to={`/host/new?from=${gameId}`}>Másolat alapján</Link>
    </nav>
    {location.state?.created === true && <p role="status">A kóstoló létrejött.</p>}
    {typeof location.state?.photoFailures === 'number' && location.state.photoFailures > 0 &&
      <p role="alert" className="auth-message">{location.state.photoFailures} fotó feltöltése nem sikerült. Az érintett boroknál lent újra hozzáadhatod.</p>}
    {state.status === 'loading' && <h2 id="saved-game-title" role="status">A kóstoló betöltése…</h2>}
    {state.status === 'error' && <><h2 id="saved-game-title">A kóstoló nem tölthető be.</h2>
      <p role="alert" className="auth-message">{state.message}</p><button className="button-primary" onClick={retry}>Újrapróbálás</button></>}
    {state.status === 'ready' && <>
      <h2 id="saved-game-title" className="saved-game-title">{state.data.title}</h2>
      <p>{gameStatusLabels[statusOverride ?? state.data.status]} · {state.data.roundSeconds === 0 ? 'Időkorlát nélkül' : `${state.data.roundSeconds} másodperc/bor`}</p>
      {lobby.schedule && <ScheduleEditor initialPlan={state.data.schedule} api={lobby.schedule} gameId={gameId} onSaved={refresh} />}
      <LiveGamePanel showTitle={false} api={lobby} gameId={gameId} onStatusChange={setStatusOverride} onVersionChange={setVersion} />
      <p className="game-hint">Játékmesteri nézet: az alábbi valós boradatok és fotók nem láthatók a játékosoknak felfedés előtt.</p>
      <ol className="saved-wine-list">{state.data.wines.map((wine) => <li key={wine.roundId}>
        <h3>{wine.position}. {wine.name}</h3>
        <p>{wine.priceHuf.toLocaleString('hu-HU')} Ft · {(wine.alcoholTenths/10).toLocaleString('hu-HU')}% vol</p>
        <WinePhotoField key={wine.photoUpdatedAt ?? 'no-photo'} api={api} gameId={gameId} wine={wine} />
      </li>)}</ol>
      <DeleteGameButton api={api} id={gameId} title={state.data.title} onDeleted={() => navigate('/host', { replace: true })} />
      <InvitePanel api={invites} gameId={gameId} status={statusOverride ?? state.data.status}
        onStatusChange={setStatusOverride} />

    </>}
  </section>;
}
