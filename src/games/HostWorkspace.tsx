import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { CreateGameForm } from './CreateGameForm';
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
  return { state, retry: () => { setState({ status: 'loading' }); setAttempt((value) => value+1); } };
}

export function HostWorkspace({ api, invites, lobby }: { api: GamesApi; invites: InvitesApi; lobby: LiveApi }) {
  const { gameId } = useParams();
  return gameId ? <HostGameDetails key={gameId} api={api} invites={invites} lobby={lobby} gameId={gameId} />
    : <><HostGameList api={api} /><CreateGameForm api={api} /></>;
}
function HostGameList({ api }: { api: GamesApi }) {
  const load = useCallback(() => api.list(), [api]);
  const { state, retry } = useGameQuery(load);
  return <section className="game-section" aria-labelledby="my-games-title">
    <h2 id="my-games-title">Saját kóstolóim</h2>
    {state.status === 'loading' && <p role="status">Kóstolók betöltése…</p>}
    {state.status === 'error' && <p role="alert" className="auth-message">{state.message}</p>}
    {state.status === 'ready' && (state.data.length ? <>
      <ul className="host-game-list">{state.data.map((game) => <li key={game.id}>
        <Link to={`/host/${game.id}`}>{game.title}</Link>
        <span>{gameStatusLabels[game.status]} · {new Date(game.createdAt).toLocaleDateString('hu-HU')}</span>
      </li>)}</ul>
      {state.data.length === 100 && <p>A legutóbbi 100 kóstolót mutatjuk.</p>}
    </> : <p>Még nincs mentett kóstolód.</p>)}
    <button className="button-secondary" disabled={state.status === 'loading'} onClick={retry}>Lista frissítése</button>
  </section>;
}
function HostGameDetails({ api, invites, lobby, gameId }: { api: GamesApi; invites: InvitesApi; lobby: LiveApi; gameId: string }) {
  const load = useCallback(() => api.get(gameId), [api, gameId]);
  const { state, retry } = useGameQuery(load);
  const [statusOverride, setStatusOverride] = useState<GameStatus | null>(null);
  const location = useLocation();
  return <section className="game-section" aria-labelledby="saved-game-title">
    <Link className="button-secondary" to="/host">Saját kóstolóim</Link>
    {location.state?.created === true && <p role="status">A kóstoló létrejött.</p>}
    {state.status === 'loading' && <h2 id="saved-game-title" role="status">A kóstoló betöltése…</h2>}
    {state.status === 'error' && <><h2 id="saved-game-title">A kóstoló nem tölthető be.</h2>
      <p role="alert" className="auth-message">{state.message}</p><button className="button-primary" onClick={retry}>Újrapróbálás</button></>}
    {state.status === 'ready' && <>
      <h2 id="saved-game-title" className="saved-game-title">{state.data.title}</h2>
      <p>{gameStatusLabels[statusOverride ?? state.data.status]} · {state.data.roundSeconds} másodperc/bor · Felfedés {state.data.revealEvery} boronként</p>
      <LiveGamePanel showTitle={false} api={lobby} gameId={gameId} onStatusChange={setStatusOverride} />
      <p className="game-hint">Játékmesteri nézet: az alábbi valós boradatok nem láthatók a játékosoknak felfedés előtt.</p>
      <ol className="saved-wine-list">{state.data.wines.map((wine) => <li key={wine.position}>
        <h3>{wine.position}. {wine.name}</h3>
        <p>{wine.priceHuf.toLocaleString('hu-HU')} Ft · {(wine.alcoholTenths/10).toLocaleString('hu-HU')}% vol</p>
      </li>)}</ol>
      <InvitePanel api={invites} gameId={gameId} status={statusOverride ?? state.data.status}
        onStatusChange={setStatusOverride} />
      <p>A boradatok mentve vannak. A borok szerkesztése még nem érhető el.</p>
    </>}
  </section>;
}
