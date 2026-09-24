import { EditorialPhoto, TastingSeal } from './EditorialPhoto';
import './tasting-insights.css';

export function TastingInsights() {
  return <section className="editorial-gallery tasting-insights" aria-labelledby="insights-title">
    <div className="editorial-heading">
      <div><p className="eyebrow">ÉRZÉKEK, EMLÉKEK, MEGLEPETÉSEK</p><h2 id="insights-title">Mit adhat a vakkóstolás?</h2></div>
      <TastingSeal />
    </div>
    <p className="insights-intro">Mit veszel észre, ha nem tudod, mi van a pohárban? A közös kóstoló arra is alkalom, hogy megfigyeld, hogyan születik meg a saját véleményed.</p>
    <div className="editorial-grid">
      <EditorialPhoto src="/images/harvest-grapes.jpg" alt="Szőlőfürtök és levelek a tőkén." number="01" width={1536} height={1024} caption={<div className="insight-copy">
        <p className="insight-topic">FIGYELEM ÉS EMLÉKEZET</p>
        <h3>Ismerős illat, saját szavakkal</h3>
        <p>Gyümölcsös, virágos, fűszeres? Nem kell rögtön szőlőfajtát találnod. A benyomások megfogalmazása kapaszkodót adhat ahhoz, hogy később felismerj egy bort.</p>
        <div className="insight-experiment"><h4>Próbáld ki</h4><p>Válassz három saját szót az illatra. Felfedés előtt térj vissza ugyanahhoz a pohárhoz: most is ezek jutnak eszedbe?</p></div>
        <details className="insight-research">
          <summary>Mit vizsgáltak a kutatók?</summary>
          <p>Egy rövid távú borfelismerési kísérletben a mintákat szóban leíró résztvevők jobban teljesítettek, mint a leírást nem készítők. Ez az adott felismerési feladat eredménye; a szakértővé válásra nem ad garanciát.</p>
          <a href="https://pubmed.ncbi.nlm.nih.gov/18622887/">Hughson és Boakes, 2009 · kutatási összefoglaló (angol)</a>
        </details>
      </div>} />
      <EditorialPhoto src="/images/vineyard-rows.jpg" alt="Szőlősorok egy domboldalon, távoli hegyekkel." number="02" caption={<div className="insight-copy">
        <p className="insight-topic">ELVÁRÁS ÉS ÉRZÉKELÉS</p>
        <h3>A történet is beleszólhat az ízbe</h3>
        <p>Amit előre hallasz egy borról, alakíthatja a kóstolás élményét. A letakart címke és a későbbre hagyott bemutatás teret ad az első, saját benyomásodnak.</p>
        <div className="insight-experiment"><h4>Próbáld ki</h4><p>A bor történetét csak a saját értékelésed után hallgasd meg. Figyeld meg, mi lep meg a felfedéskor.</p></div>
        <details className="insight-research">
          <summary>Mit vizsgáltak a kutatók?</summary>
          <p>Egy kísérletben a kóstolás előtt kapott negatív információ alacsonyabb értékeléshez vezetett, mint a pozitív. Ha az információ csak kóstolás után érkezett, ezt a különbséget nem találták. Az eredmény arra utal, hogy az elvárás az élményt is alakíthatja.</p>
          <a href="https://pubmed.ncbi.nlm.nih.gov/19501777/">Siegrist és Cousin, 2009 · kutatási összefoglaló (angol)</a>
        </details>
      </div>} />
      <EditorialPhoto src="/images/blind-tasting-table.jpg" alt="Poharak és letakart palackok egy közös kóstolóhoz megterített asztalon." number="03" caption={<div className="insight-copy">
        <p className="insight-topic">SAJÁT VÉLEMÉNY, KÖZÖS ÉLMÉNY</p>
        <h3>Előbb te, aztán a társaság</h3>
        <p>Érdekesebb összevetni a benyomásokat, ha előbb mindenki önállóan fogalmazza meg őket. Így a beszélgetésben az is kiderülhet, mennyire mást vettetek észre ugyanabban a borban.</p>
        <div className="insight-experiment"><h4>Próbáld ki</h4><p>Az első benyomás idejére tartsatok egy kis csendet. Csak a saját értékelések rögzítése után osszátok meg, ki mit érzett.</p></div>
        <details className="insight-research">
          <summary>Mit vizsgáltak a kutatók?</summary>
          <p>Két kísérletben a társak és szakértők magasabb értékelése növelte, mennyit fizetnének a résztvevők a borért, a saját értékelésük figyelembevétele mellett is. Ez vásárlási döntésre vonatkozó eredmény, nem az ízérzet változásának bizonyítéka.</p>
          <a href="https://doi.org/10.1017/age.2023.11">Weerasekara és Streletskaya, 2023 · tanulmány (angol)</a>
        </details>
      </div>} />
    </div>
    <p className="insights-note">A kipróbálható ötletek a kóstolóhoz szólnak; a hivatkozott kutatások nem a Vakkóstoló alkalmazást vizsgálták.</p>
  </section>;
}
