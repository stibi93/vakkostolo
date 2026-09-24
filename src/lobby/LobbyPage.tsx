import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageFrame } from '../app/PageFrame';
import { authRuntime } from '../auth/runtime';
import type { GameStatus } from '../domain/game';
import { isUuid } from '../games/model';
import { LiveGamePanel } from '../live/LiveGamePanel';
import { HomeAtmosphere, HomeMotionToggle } from '../ui/HomeAtmosphere';
import { useAmbientMotion } from '../ui/useAmbientMotion';

export function LobbyPage() {
  const { gameId } = useParams();
  const motion = useAmbientMotion();
  const [status, setStatus] = useState<GameStatus | null>(null);
  const onStatusChange = useCallback((value: GameStatus) => setStatus(value), []);
  // The background stays still while a round is being rated.
  const ambient = { ...motion, running: motion.running && status !== 'tasting' };
  return <HomeAtmosphere motion={ambient}><PageFrame headerAction={<HomeMotionToggle motion={motion} />}>
    <section className="auth-panel player-session" aria-labelledby="lobby-title">
      <p className="eyebrow">KÓSTOLÓ</p><h1 className="sr-only" id="lobby-title">Kóstoló</h1>
      {authRuntime.status !== 'ready' ? <p>Az online kapcsolat nincs beállítva ezen a címen.</p>
        : !isUuid(gameId) ? <p role="alert">A kóstoló címe érvénytelen. Nyisd meg újra a meghívót.</p>
        : <LiveGamePanel key={gameId} api={authRuntime.lobby} gameId={gameId} onStatusChange={onStatusChange} />}
      <p><Link to="/">Vissza a kezdőlapra</Link></p>
    </section>
  </PageFrame></HomeAtmosphere>;
}
