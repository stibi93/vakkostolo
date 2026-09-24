import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router';
import { PageFrame } from './PageFrame';
import { HomePage } from './HomePage';
import './app.css';

const DemoApp = lazy(() => import('../demo/DemoApp').then((module) => ({ default: module.DemoApp })));
const HostArea = lazy(() => import('../auth/HostArea').then((module) => ({ default: module.HostArea })));
const JoinPage = lazy(() => import('../invites/JoinPage').then((module) => ({ default: module.JoinPage })));

export function App() {
  return (
    <Suspense fallback={<PageFrame><p role="status">Az oldal betöltése…</p></PageFrame>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/demo" element={<DemoApp />} />
        <Route path="/host" element={<HostArea />} />
        <Route path="/host/:gameId" element={<HostArea />} />
        <Route path="/auth/callback" element={<HostArea />} />
        <Route path="/join/:token" element={<JoinPage />} />
        <Route path="*" element={<PageFrame>
          <p className="eyebrow">404 · ISMERETLEN OLDAL</p>
          <h1>Az oldal nem található.</h1>
          <p>Ellenőrizd a címet, vagy térj vissza a kezdőlapra.</p>
          <Link className="button-primary" to="/">Vissza a kezdőlapra <span aria-hidden="true">↗</span></Link>
        </PageFrame>} />
      </Routes>
    </Suspense>
  );
}
