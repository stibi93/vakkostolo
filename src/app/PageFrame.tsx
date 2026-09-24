import type { ReactNode } from 'react';
import { Link } from 'react-router';

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell entry-shell">
      <a className="skip-link" href="#main">Ugrás a tartalomhoz</a>
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Vakpohár, kezdőlap">vakpohár<span aria-hidden="true">.</span></Link>
        <span className="topbar-note">BOR VAN. CÍMKE NINCS.</span>
        <span className="demo-badge"><span aria-hidden="true" />FEJLESZTÉS ALATT</span>
      </header>
      <main id="main" className="entry-main" tabIndex={-1}>{children}</main>
      <footer><span className="footer-wordmark">vakpohár.</span><span>JÓ TÁRSASÁGHOZ. ISMERETLEN BOROKHOZ.</span></footer>
    </div>
  );
}
