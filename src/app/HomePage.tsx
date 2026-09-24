import { PageFrame } from './PageFrame';
import { Link } from 'react-router';

export function HomePage() {
  return (
    <PageFrame>
      <section className="entry-poster" aria-labelledby="welcome-title">
        <div className="entry-intro">
          <p className="eyebrow">VAKBORKÓSTOLÓ</p>
          <h1 id="welcome-title">Kóstoló<br />telefonon.</h1>
          <p className="entry-copy">Becsüld meg a bor árát és alkoholfokát, majd értékeld, mennyire ízlik.</p>
          <p className="entry-copy">A demóban három mintaborral próbálhatod ki a kóstolólapot és az eredmények felfedését.</p>
          <Link className="button-primary" to="/demo">Próbakóstoló megnyitása <span aria-hidden="true">↗</span></Link>
          <p className="entry-note">Helyi demó, regisztráció nélkül. A tippek az oldal frissítéséig maradnak meg.</p>
        </div>
        <aside className="entry-sample" aria-label="Minta az értékelőlapról">
          <p className="eyebrow">KÓSTOLÓLAP · MINTA</p>
          <h2>01. tétel</h2>
          <p>A bor adatai a felfedésig rejtve maradnak.</p>
          <dl>
            <div><dt>Becsült palackár</dt><dd>4 500 <small>Ft</small></dd></div>
            <div><dt>Becsült alkoholfok</dt><dd>13,5 <small>%</small></dd></div>
            <div><dt>Tetszés</dt><dd className="sample-liking">7 <small>/ 10</small></dd></div>
          </dl>
          <p className="sample-caption">Példaértékek. A saját tippedet a próbakóstolóban adhatod meg.</p>
        </aside>
      </section>
      <section className="entry-next" aria-labelledby="next-title">
        <p className="eyebrow">FEJLESZTÉSI TERVEK</p>
        <h2 id="next-title">Többjátékos kóstoló</h2>
        <p>A közös online kóstoló még készül. Játékmesterként már beléphetsz; a meghívó és a közös váró ezután következik.</p>
        <p>A demóban egy böngészőlapon válthatsz a játékmester, a játékos és a kivetítő nézete között.</p>
        <Link className="button-secondary" to="/host">Játékmesteri belépés</Link>
      </section>
    </PageFrame>
  );
}
