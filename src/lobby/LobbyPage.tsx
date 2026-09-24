import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageFrame } from '../app/PageFrame';
import { authRuntime } from '../auth/runtime';
import type { GameStatus } from '../domain/game';
import { isUuid } from '../games/model';
import { LiveGamePanel } from '../live/LiveGamePanel';

export function LobbyPage() {
  const { gameId } = useParams();
  const [status, setStatus] = useState<GameStatus | null>(null);
  const onStatusChange = useCallback((value: GameStatus) => setStatus(value), []);
  return <PageFrame>
    <section className={`auth-panel player-session${status === 'lobby' ? ' player-waiting' : ''}`} aria-labelledby="lobby-title">
      <p className="eyebrow">KÓSTOLÓ</p><h1 className="sr-only" id="lobby-title">Kóstoló</h1>
      {authRuntime.status !== 'ready' ? <p>Az online kapcsolat nincs beállítva ezen a címen.</p>
        : !isUuid(gameId) ? <p role="alert">A kóstoló címe érvénytelen. Nyisd meg újra a meghívót.</p>
        : <LiveGamePanel key={gameId} api={authRuntime.lobby} gameId={gameId} onStatusChange={onStatusChange} />}
      <p><Link to="/">Vissza a kezdőlapra</Link></p>
    </section>
  </PageFrame>;
}
