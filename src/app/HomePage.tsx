import { Link } from 'react-router';
import { PageFrame } from './PageFrame';
import { HarvestArtwork } from '../ui/HarvestArtwork';

export function HomePage() {
  return <PageFrame>
    <section className="entry-poster" aria-labelledby="welcome-title">
      <div className="entry-intro">
        <p className="eyebrow">KÖZÖS BORKÓSTOLÓ · SAJÁT TIPPEK</p>
        <h1 id="welcome-title">Vakborkóstoló,<br /><em>telefonon.</em></h1>
        <p className="entry-copy">Becsüld meg az árat és az alkoholfokot. Értékeld a bort, majd a felfedés után nézd meg, mennyire volt pontos a tipped.</p>
        <Link className="button-primary" to="/demo">Próbakóstoló megnyitása <span aria-hidden="true">↗</span></Link>
        <p className="entry-note">Helyi demó, három mintaborral. A tippek és a kiválasztott képek az oldal frissítéséig maradnak meg.</p>
      </div>
      <HarvestArtwork />
    </section>
    <section className="entry-steps" aria-label="A kóstoló lépései">
      <div><span>01</span><div><h2>Kóstolj.</h2><p>A tételszám alapján azonosíthatod az aktuális bort.</p></div></div>
      <div><span>02</span><div><h2>Add meg a tipped.</h2><p>Ár, alkoholfok és tetszés a saját telefonodon.</p></div></div>
      <div><span>03</span><div><h2>Nézd meg az eredményt.</h2><p>Felfedéskor a becslés a valódi adat mellé kerül.</p></div></div>
    </section>
    <section className="entry-next" aria-labelledby="next-title">
      <div><p className="eyebrow">ONLINE KÓSTOLÓ ELŐKÉSZÍTÉSE</p><h2 id="next-title">Játékmesterként</h2>
        <p>A közös online kóstoló még készül. Létrehozhatod a kóstolót, meghívhatod a résztvevőket, és elindíthatod az első kört. A további körvezérlés és az eredmények még készülnek.</p>
      </div>
      <Link className="button-secondary" to="/host">Játékmesteri belépés</Link>
    </section>
  </PageFrame>;
}
