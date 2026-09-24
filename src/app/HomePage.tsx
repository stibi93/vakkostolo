import { Link } from 'react-router';
import { PageFrame } from './PageFrame';
import { HarvestArtwork } from '../ui/HarvestArtwork';
import { HomeAtmosphere, HomeMotionToggle } from '../ui/HomeAtmosphere';
import { useAmbientMotion } from '../ui/useAmbientMotion';
import { TastingInsights } from '../ui/TastingInsights';

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
    <TastingInsights />
  </PageFrame></HomeAtmosphere>;
}
