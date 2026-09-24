import { Link } from 'react-router';
import { PageFrame } from './PageFrame';
import { HarvestArtwork } from '../ui/HarvestArtwork';
import { useAppMotion } from '../ui/useAppMotion';
import { TastingInsights } from '../ui/TastingInsights';

export function HomePage() {
  const motion = useAppMotion();
  return <PageFrame headerAction={
    <Link className="header-link" to="/jatekmester">Játékmestereknek</Link>
  }>
    <section className="entry-poster" aria-labelledby="welcome-title">
      <div className="entry-intro">
        <p className="eyebrow">KÖZÖS BORKÓSTOLÓ · SAJÁT TIPPEK</p>
        <h1 id="welcome-title">Vakborkóstoló,<br /><em>telefonon.</em></h1>
        <p className="entry-copy">Kóstolj a többiekkel, és rögzítsd a saját értékelésedet a telefonodon.</p>
        <Link className="button-primary" to="/join">Csatlakozás a játékhoz <span aria-hidden="true">↗</span></Link>
        <p className="entry-note">A játékmester meghívólinkjével és egy becenévvel beléphetsz a közös váróba.</p>
      </div>
      <HarvestArtwork motion={motion} />
    </section>
    <TastingInsights />
  </PageFrame>;
}
