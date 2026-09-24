import { Link } from 'react-router';
import { PageFrame } from './PageFrame';
import { HarvestArtwork } from '../ui/HarvestArtwork';
import { HomeAtmosphere, HomeMotionToggle } from '../ui/HomeAtmosphere';
import { useAmbientMotion } from '../ui/useAmbientMotion';
import { EditorialPhoto, TastingSeal } from '../ui/EditorialPhoto';
import './home-guide.css';

export function HomePage() {
  const motion = useAmbientMotion();
  return <HomeAtmosphere motion={motion}><PageFrame headerAction={<div className="home-header-actions">
    <Link className="header-link" to="/jatekmester">Játékmestereknek</Link><HomeMotionToggle motion={motion} />
  </div>}>
    <section className="entry-poster" aria-labelledby="welcome-title">
      <div className="entry-intro">
        <p className="eyebrow">KÖZÖS BORKÓSTOLÓ · SAJÁT TIPPEK</p>
        <h1 id="welcome-title">Vakborkóstoló,<br /><em>telefonon.</em></h1>
        <p className="entry-copy">Kóstolj a többiekkel, és rögzítsd a saját értékelésedet a telefonodon.</p>
        <Link className="button-primary" to="/demo">Próbakóstoló megnyitása <span aria-hidden="true">↗</span></Link>
        <p className="entry-note">Helyi demó, három mintaborral. A tippek és a kiválasztott képek az oldal frissítéséig maradnak meg.</p>
      </div>
      <HarvestArtwork motion={motion} />
    </section>
    <section className="editorial-gallery home-guide" aria-labelledby="gallery-title">
      <div className="editorial-heading"><div><p className="eyebrow">A KÓSTOLÓ ELŐTT</p><h2 id="gallery-title">Készülj a kóstolóra</h2></div><TastingSeal /></div>
      <div className="editorial-grid">
        <EditorialPhoto src="/images/harvest-grapes.jpg" alt="Sötét szőlőfürtök és levelek a tőkén, háttérben a szőlőskert." number="01" width={1536} height={1024} caption={<div className="home-guide-copy">
          <h3>Állítsd össze a borsort</h3>
          <p>Válassz közös témát: például egy szőlőfajtát vagy borvidéket. Játékmesterként előre rögzítheted a borokat és a sorrendjüket.</p>
          <Link className="home-guide-action" to="/jatekmester">Szervezői útmutató <span aria-hidden="true">↗</span></Link>
        </div>} />
        <EditorialPhoto src="/images/vineyard-rows.jpg" alt="Szőlősorok egy domboldalon, távolban ködös hegyekkel." number="02" caption={<div className="home-guide-copy">
          <h3>Takard el az eredetet</h3>
          <p>A borvidék, a termelő és a címke is befolyásolhatja a várakozásokat. Kóstoláskor csak a palack sorszáma legyen látható.</p>
          <details className="home-guide-checklist">
            <summary>Előkészítési ellenőrzőlista</summary>
            <ul>
              <li>Takard le a palackokat, a nyakon lévő jelölésekkel együtt.</li>
              <li>Számozd meg őket a kóstolás sorrendjében.</li>
              <li>A borok nevét és sorrendjét csak a játékmester lássa.</li>
            </ul>
          </details>
        </div>} />
        <EditorialPhoto src="/images/blind-tasting-table.jpg" alt="Borospoharak és letakart palackok egy megterített kóstolóasztalon." number="03" caption={<div className="home-guide-copy">
          <h3>Próbáld ki a menetét</h3>
          <p>A demóban végigmehetsz az indításon, a kóstolólap kitöltésén és a felfedésen. Három mintaborral, bejelentkezés nélkül.</p>
          <Link className="home-guide-action" to="/demo">Demó kipróbálása <span aria-hidden="true">↗</span></Link>
          <p className="home-guide-note">Helyi próba: újratöltéskor a megadott tippek törlődnek.</p>
        </div>} />
      </div>
    </section>
  </PageFrame></HomeAtmosphere>;
}
