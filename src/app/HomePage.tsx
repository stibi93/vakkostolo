import { PageFrame } from './PageFrame';
import { Link } from 'react-router';

export function HomePage() {
  return (
    <PageFrame>
      <section className="entry-poster" aria-labelledby="welcome-title">
        <p className="eyebrow">VAKKÓSTOLÓ, BARÁTOK KÖZÖTT</p>
        <h1 id="welcome-title">A címke titok.<br />A tipped szabad.</h1>
        <p className="entry-copy">Mennyibe kerülhet? Hány fokos? És ami a legfontosabb: ízlik?</p>
        <p className="entry-copy">Próbáld ki a kóstolólapot három mintaborral, és a végén fedd fel, mi került a pohárba.</p>
        <Link className="button-primary" to="/demo">Próbakóstoló megnyitása <span aria-hidden="true">↗</span></Link>
        <p className="entry-note">Helyi demó, regisztráció nélkül. A tippek az oldal frissítéséig maradnak meg.</p>
      </section>
      <section className="entry-next" aria-labelledby="next-title">
        <p className="eyebrow">A KÖVETKEZŐ KÖR</p>
        <h2 id="next-title">Közös asztal, saját telefon.</h2>
        <p>A közös online kóstoló még készül. Játékmesterként már beléphetsz; a meghívó és a közös váró ezután következik.</p>
        <p>Most a próbakóstolóban tudod végigjárni a játékmester, a játékos és a kivetítő nézetét, egyetlen böngészőlapon.</p>
        <Link className="button-secondary" to="/host">Játékmesteri belépés</Link>
      </section>
    </PageFrame>
  );
}
