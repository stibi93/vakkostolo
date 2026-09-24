import { Link } from 'react-router';
import { PageFrame } from './PageFrame';
import { EditorialPhoto } from '../ui/EditorialPhoto';

export function OrganizerPage() {
  return <PageFrame headerAction={<Link className="header-link" to="/">Vissza a kezdőlapra</Link>}>
    <section className="organizer-intro" aria-labelledby="organizer-title">
      <div>
        <p className="eyebrow">JÁTÉKMESTEREKNEK</p>
        <h1 id="organizer-title">Kóstoló szervezése</h1>
        <p className="organizer-lead">Állítsd össze a borsort, hívd meg a résztvevőket, és indítsd el a kóstolást. A vendégek a saját telefonjukon adják meg a tippjeiket.</p>
        <p className="organizer-status">A közös online kóstoló még készül. Létrehozhatod a kóstolót, meghívhatod a résztvevőket, és elindíthatod az első kört. A további körvezérlés és az eredmények még készülnek.</p>
        <div className="actions">
          <Link className="button-primary" to="/host">Játékmesteri belépés <span aria-hidden="true">↗</span></Link>
          <Link className="button-secondary" to="/demo">Próbakóstoló megnyitása</Link>
        </div>
      </div>
      <EditorialPhoto src="/images/blind-tasting-table.jpg" alt="Borospoharak és textillel letakart palackok egy kóstolóasztalon." number="01" caption="A kóstoló előkészítése" eager />
    </section>
    <section className="organizer-steps" aria-labelledby="organizer-steps-title">
      <h2 id="organizer-steps-title">Így készítsd elő</h2>
      <ol>
        <li><span aria-hidden="true">01</span><h3>Állítsd össze a borsort</h3><p>Add meg a borokat a kóstolás sorrendjében. A palackokat takard le, és jelöld a tételszámmal.</p></li>
        <li><span aria-hidden="true">02</span><h3>Nyisd meg a várót</h3><p>A résztvevők a QR-kóddal vagy a meghívólinkkel, egy becenév megadásával csatlakozhatnak.</p></li>
        <li><span aria-hidden="true">03</span><h3>Indítsd el az első kört</h3><p>Ha mindenki készen áll, indítsd el a kóstolást. A résztvevők a saját telefonjukon töltik ki a kóstolólapot.</p></li>
      </ol>
    </section>
  </PageFrame>;
}
