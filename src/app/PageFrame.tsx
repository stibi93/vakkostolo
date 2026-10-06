import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { HomeMotionToggle } from '../ui/HomeAtmosphere';
import { useAppMotion } from '../ui/useAppMotion';

export function PageFrame({ children, headerAction }: { children: ReactNode; headerAction?: ReactNode }) {
  const motion = useAppMotion();
  return (
    <div className="app-shell entry-shell">
      <a className="skip-link" href="#main">Ugrás a tartalomhoz</a>
      <header className="topbar">
        <Link className="brand" to="/" viewTransition aria-label="Vakkóstoló, kezdőlap">Vakkóstoló</Link>
        <span className="dev-badge"><span aria-hidden="true" />FEJLESZTÉS ALATT</span>
        <div className="home-header-actions">{headerAction}<HomeMotionToggle motion={motion} /></div>
      </header>
      <main id="main" className="entry-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
