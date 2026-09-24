import { Link, useParams } from 'react-router';
import { PageFrame } from '../app/PageFrame';
import { authRuntime } from '../auth/runtime';
import { isUuid } from '../games/model';
import { LobbyPanel } from './LobbyPanel';

export function LobbyPage() {
  const { gameId } = useParams();
  return <PageFrame><section className="auth-panel" aria-labelledby="lobby-title">
    <p className="eyebrow">KÓSTOLÓ</p><h1 id="lobby-title">Közös váró</h1>
    {authRuntime.status !== 'ready' ? <p>Az online kapcsolat nincs beállítva ezen a címen.</p>
      : !isUuid(gameId) ? <p role="alert">A kóstoló címe érvénytelen. Nyisd meg újra a meghívót.</p>
      : <LobbyPanel key={gameId} api={authRuntime.lobby} gameId={gameId} />}
    <p><Link to="/">Vissza a kezdőlapra</Link></p>
  </section></PageFrame>;
}
