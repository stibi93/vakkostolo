import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router';
import { PageFrame } from './PageFrame';
import { HomePage } from './HomePage';
import './app.css';
import { HomeAtmosphere } from '../ui/HomeAtmosphere';
import { useAmbientMotion } from '../ui/useAmbientMotion';
import { AppMotionContext } from '../ui/useAppMotion';

const OrganizerPage = lazy(() => import('./OrganizerPage').then((module) => ({ default: module.OrganizerPage })));
const HostArea = lazy(() => import('../auth/HostArea').then((module) => ({ default: module.HostArea })));
const ProjectorPage = lazy(() => import('../invites/ProjectorPage').then((module) => ({ default: module.ProjectorPage })));
const JoinPage = lazy(() => import('../invites/JoinPage').then((module) => ({ default: module.JoinPage })));
const PlayerEntryPage = lazy(() => import('../invites/PlayerEntryPage').then((module) => ({ default: module.PlayerEntryPage })));

const LobbyPage = lazy(() => import('../lobby/LobbyPage').then((module) => ({ default: module.LobbyPage })));

export function App() {
  const motion = useAmbientMotion();
  return (
    <AppMotionContext value={motion}><HomeAtmosphere motion={motion}><Suspense fallback={<PageFrame><p role="status">Az oldal betöltése…</p></PageFrame>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/jatekmester" element={<OrganizerPage />} />
        <Route path="/host/*" element={<HostArea />} />
        <Route path="/present/:gameId" element={<ProjectorPage />} />
        <Route path="/auth/callback" element={<HostArea />} />
        <Route path="/play/:gameId" element={<LobbyPage />} />
        <Route path="/join" element={<PlayerEntryPage />} />
        <Route path="/join/:token" element={<JoinPage />} />
        <Route path="*" element={<PageFrame>
          <p className="eyebrow">404 · ISMERETLEN OLDAL</p>
          <h1>Az oldal nem található.</h1>
          <p>Ellenőrizd a címet, vagy térj vissza a kezdőlapra.</p>
          <Link className="button-primary" to="/">Vissza a kezdőlapra <span aria-hidden="true">↗</span></Link>
        </PageFrame>} />
      </Routes>
    </Suspense></HomeAtmosphere></AppMotionContext>
  );
}
