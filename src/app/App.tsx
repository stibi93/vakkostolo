import { lazy, Suspense } from 'react';
import { PageFrame } from './PageFrame';
import { HomePage } from './HomePage';
import './app.css';

// Sample wine identities belong only to the explicitly opened demo.
const DemoApp = lazy(() => import('../demo/DemoApp').then((module) => ({ default: module.DemoApp })));

export function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';

  if (pathname === '/demo') {
    return (
      <Suspense fallback={<PageFrame><p role="status">A próbakóstoló betöltése…</p></PageFrame>}>
        <DemoApp />
      </Suspense>
    );
  }

  if (pathname === '/') return <HomePage />;

  return (
    <PageFrame>
      <p className="eyebrow">404 · ISMERETLEN OLDAL</p>
      <h1>Ez az oldal nincs a borsorban.</h1>
      <p>Ellenőrizd a címet, vagy térj vissza a kezdőlapra.</p>
      <a className="button-primary" href="/">Vissza a kezdőlapra <span aria-hidden="true">↗</span></a>
    </PageFrame>
  );
}
