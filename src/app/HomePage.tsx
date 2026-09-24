import { PageFrame } from './PageFrame';

export function HomePage() {
  return (
    <PageFrame>
      <section className="entry-poster" aria-labelledby="welcome-title">
        <p className="eyebrow">VAKKÓSTOLÓ, BARÁTOK KÖZÖTT</p>
        <h1 id="welcome-title">A címke titok.<br />A tipped szabad.</h1>
        <p className="entry-copy">Mennyibe kerülhet? Hány fokos? És ami a legfontosabb: ízlik?</p>
        <p className="entry-copy">Próbáld ki a kóstolólapot három mintaborral, és a végén fedd fel, mi került a pohárba.</p>
        <a className="button-primary" href="/demo">Próbakóstoló megnyitása <span aria-hidden="true">↗</span></a>
        <p className="entry-note">Helyi demó, regisztráció nélkül. A tippek az oldal frissítéséig maradnak meg.</p>
      </section>
      <section className="entry-next" aria-labelledby="next-title">
        <p className="eyebrow">A KÖVETKEZŐ KÖR</p>
        <h2 id="next-title">Közös asztal, saját telefon.</h2>
        <p>A közös online kóstoló még készül. Játékmesteri belépéssel, meghívóval és közös váróval bővül majd az alkalmazás.</p>
        <p>Most a próbakóstolóban tudod végigjárni a játékmester, a játékos és a kivetítő nézetét, egyetlen böngészőlapon.</p>
      </section>
    </PageFrame>
  );
}
