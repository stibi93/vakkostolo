import { EditorialPhoto, TastingSeal } from './EditorialPhoto';
import './tasting-insights.css';

export function TastingInsights() {
  return <section className="editorial-gallery tasting-insights" aria-labelledby="insights-title">
    <div className="editorial-heading">
      <h2 id="insights-title">Mi befolyásolja a kóstolást?</h2>
      <TastingSeal />
    </div>
    <p className="insights-intro">Vakkóstoláskor a bor nevét és árát az értékelés után ismered meg. A következő kutatások megmutatják, hogyan függhet össze a kóstolás az emlékezettel, az elvárásokkal és mások véleményével.</p>
    <div className="editorial-grid">
      <EditorialPhoto src="/images/harvest-grapes.jpg" alt="Szőlőfürtök és levelek a tőkén." number="01" width={1536} height={1024} caption={<div className="insight-copy">
        <h3>A leírás segíthet emlékezni</h3>
        <p>Egy borfelismerési kísérletben azok, akik szavakkal is leírták a bort, később pontosabban választották ki a minták közül. A leírás a kezdő és a tapasztaltabb résztvevőknek is segített.</p>
        <div className="insight-experiment"><h4>Próbáld ki</h4><p>Keress három ismerős illatot, például almát, citromot vagy vaníliát. Jegyezd fel őket, majd kóstold újra a bort, és vesd össze a benyomásaidat.</p></div>
        <details className="insight-research">
          <summary>Mit vizsgáltak a kutatók?</summary>
          <p>Hughson és Boakes kezdő és közepesen tapasztalt borfogyasztókat hasonlított össze. A résztvevők egy része leírta a megjegyzendő borokat, másik része nem. Ez rövid távú felismerési feladat volt, nem a szőlőfajta vagy az évjárat azonosítása.</p>
          <a href="https://pubmed.ncbi.nlm.nih.gov/18622887/">Hughson és Boakes, 2009 · kutatási összefoglaló (angol)</a>
        </details>
      </div>} />
      <EditorialPhoto src="/images/vineyard-rows.jpg" alt="Szőlősorok egy domboldalon, távoli hegyekkel." number="02" caption={<div className="insight-copy">
        <h3>Az előzetes vélemény számít</h3>
        <p>Siegrist és Cousin kísérletében alacsonyabbra értékelték a bort azok, akik kóstolás előtt negatív információt kaptak róla. Ha az információt csak kóstolás után hallották, ez a különbség nem jelentkezett.</p>
        <div className="insight-experiment"><h4>Próbáld ki</h4><p>A címkét, az árat és a bor bemutatását hagyjátok a tippek beküldése utánra. Felfedéskor nézd meg, mennyire egyezik a saját értékelésed azzal, amit előre vártál volna.</p></div>
        <details className="insight-research">
          <summary>Mit vizsgáltak a kutatók?</summary>
          <p>A kutatók 136 résztvevőnél vizsgálták a borról kapott pozitív és negatív információ hatását. Az információt egyes csoportok kóstolás előtt, mások utána, de még az értékelés előtt kapták meg. Az eredmény arra utal, hogy az elvárás a kóstolási élményt is alakíthatja.</p>
          <a href="https://pubmed.ncbi.nlm.nih.gov/19501777/">Siegrist és Cousin, 2009 · kutatási összefoglaló (angol)</a>
        </details>
      </div>} />
      <EditorialPhoto src="/images/blind-tasting-table.jpg" alt="Poharak és letakart palackok egy közös kóstolóhoz megterített asztalon." number="03" caption={<div className="insight-copy">
        <h3>Mások pontszáma az értékre is hat</h3>
        <p>Két kísérletben a résztvevők többet fizettek volna a borért, ha más kóstolók vagy szakértők magasabbra értékelték. A hatás a saját értékelésük figyelembevétele mellett is megmaradt.</p>
        <div className="insight-experiment"><h4>Próbáld ki</h4><p>Először mindenki önállóan küldje be az ártippjét és a tetszési értékét. Utána hasonlítsátok össze, kinek melyik bor ízlett, és mennyire becsültétek az árát.</p></div>
        <details className="insight-research">
          <summary>Mit vizsgáltak a kutatók?</summary>
          <p>Weerasekara és Streletskaya kóstolókkal és valódi vásárlással járó aukciókkal vizsgálta mások értékelésének hatását. Azt mérték, mennyit ajánlanak a résztvevők egy borért; ebből önmagában nem következik, hogy az ízét is másnak érezték.</p>
          <a href="https://doi.org/10.1017/age.2023.11">Weerasekara és Streletskaya, 2023 · tanulmány (angol)</a>
        </details>
      </div>} />
    </div>
    <p className="insights-note">Az ötleteket a saját kóstolótokon próbálhatjátok ki. A hivatkozott kutatások borértékelést és fogyasztói döntéseket vizsgáltak, nem ezt az alkalmazást.</p>
  </section>;
}
