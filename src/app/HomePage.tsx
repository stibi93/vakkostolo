import { Link } from 'react-router';
import { PageFrame } from './PageFrame';
import { HarvestArtwork } from '../ui/HarvestArtwork';
import { HomeAtmosphere, HomeMotionToggle } from '../ui/HomeAtmosphere';
import { useAmbientMotion } from '../ui/useAmbientMotion';
import { EditorialPhoto, TastingSeal } from '../ui/EditorialPhoto';

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
    <section className="entry-steps" aria-label="A kóstoló lépései">
      <div><span>01</span><div><h2>Kóstolj.</h2><p>A tételszám alapján azonosíthatod az aktuális bort.</p></div></div>
      <div><span>02</span><div><h2>Add meg a tipped.</h2><p>Rögzítsd a saját értékelésedet.</p></div></div>
      <div><span>03</span><div><h2>Nézd meg az eredményt.</h2><p>Felfedéskor a becslés a valódi adat mellé kerül.</p></div></div>
    </section>
    <section className="editorial-gallery" aria-labelledby="gallery-title">
      <div className="editorial-heading"><div><p className="eyebrow">VAKKÓSTOLÓ</p><h2 id="gallery-title">Szőlő, dűlő, kóstoló</h2></div><TastingSeal /></div>
      <div className="editorial-grid">
        <EditorialPhoto src="/images/harvest-grapes.jpg" alt="Sötét szőlőfürtök és levelek a tőkén, háttérben a szőlőskert." number="01" caption="A szőlő" width={1536} height={1024} />
        <EditorialPhoto src="/images/vineyard-rows.jpg" alt="Szőlősorok egy domboldalon, távolban ködös hegyekkel." number="02" caption="A dűlő" />
        <EditorialPhoto src="/images/blind-tasting-table.jpg" alt="Borospoharak és letakart palackok egy megterített kóstolóasztalon." number="03" caption="A kóstoló" />
      </div>
    </section>
  </PageFrame></HomeAtmosphere>;
}
