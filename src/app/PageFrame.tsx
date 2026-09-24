import type { ReactNode } from 'react';
import { Link } from 'react-router';

export function PageFrame({ children, headerAction }: { children: ReactNode; headerAction?: ReactNode }) {
  return (
    <div className="app-shell entry-shell">
      <a className="skip-link" href="#main">Ugrás a tartalomhoz</a>
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Vakkóstoló, kezdőlap">Vakkóstoló</Link>
        <span className="topbar-note">VAKBORKÓSTOLÓ</span>
        <span className="demo-badge"><span aria-hidden="true" />FEJLESZTÉS ALATT</span>
        {headerAction}
      </header>
      <main id="main" className="entry-main" tabIndex={-1}>{children}</main>
      <footer><span className="footer-wordmark">Vakkóstoló</span></footer>
    </div>
  );
}
