import { Link } from 'react-router';
import { PageFrame } from './PageFrame';
import { HarvestArtwork } from '../ui/HarvestArtwork';
import { useAppMotion } from '../ui/useAppMotion';
import { TastingInsights } from '../ui/TastingInsights';

export function HomePage() {
  const motion = useAppMotion();
  return <PageFrame headerAction={
    <Link className="header-link" to="/jatekmester" viewTransition>Játékmestereknek</Link>
  }>
    <section className="entry-poster" aria-labelledby="welcome-title">
      <div className="entry-intro">
        <p className="eyebrow">KÖZÖS BORKÓSTOLÓ · SAJÁT TIPPEK</p>
        <h1 id="welcome-title">Kóstolj vakon.<br /><em>Tippelj telefonon.</em></h1>
        <p className="entry-copy">Tippeld meg a bor árát és alkoholfokát, és jelöld, mennyire ízlik. Felfedéskor a telefonodon látod a valódi adatokat és a pontjaidat.</p>
        <Link className="button-primary" to="/join" viewTransition>Csatlakozás a játékhoz <span aria-hidden="true">↗</span></Link>
        <p className="entry-note">Olvasd be a játékmester QR-kódját, vagy nyisd meg a meghívólinkjét. A belépéshez elég egy becenév, alkalmazást nem kell telepítened.</p>
      </div>
      <HarvestArtwork motion={motion} />
    </section>
    <TastingInsights />
  </PageFrame>;
}
