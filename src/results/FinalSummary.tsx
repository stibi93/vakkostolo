import type { ReactNode } from 'react';
import type { GameResults } from './model';
import { rankWines } from './wineRanking';

const numeric = (value: number) => value.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
const stat = (value: number | null) => value === null ? '—' : numeric(value);
const label = (position: number, name: string) => `${String(position).padStart(2, '0')}. ${name}`;

/** Closing slide: headline facts, the player ranking passed in, and every wine with its liking statistics. */
export function FinalSummary({ results, ranking }: { results: GameResults; ranking: ReactNode }) {
  const wines = rankWines(results.wines);
  const favourite = wines[0]?.rank === 1 ? wines[0] : null;
  const divisive = wines.filter(row => row.stats.count >= 2).sort((a, b) => b.stats.spread! - a.stats.spread!)[0];
  const winners = results.leaderboard.filter(entry => entry.rank === 1);
  return <section className="final-summary" aria-label="Végeredmény">
    <dl className="final-highlights">
      <div><dt>Győztes</dt><dd>{winners.length ? winners.map(entry => entry.nickname).join(' · ') : '—'}</dd>
        {!!winners.length && <dd className="final-highlight-note">{winners[0].points} / {results.maxPoints} pont</dd>}</div>
      <div><dt>Közönségkedvenc</dt><dd>{favourite ? label(favourite.wine.position, favourite.wine.name) : '—'}</dd>
        {favourite && <dd className="final-highlight-note">átlag {stat(favourite.stats.mean)} / 10</dd>}</div>
      <div><dt>Legmegosztóbb bor</dt><dd>{divisive ? label(divisive.wine.position, divisive.wine.name) : '—'}</dd>
        {divisive && <dd className="final-highlight-note">szórás {stat(divisive.stats.spread)}</dd>}</div>
      <div><dt>Kóstoló</dt><dd>{results.wines.length} bor · {results.leaderboard.length} játékos</dd></div>
    </dl>
    <div className="final-columns">
      <div className="final-players">{ranking}</div>
      <section className="final-wines" aria-labelledby="final-wines-title">
        <h3 id="final-wines-title">Borok a tetszés sorrendjében</h3>
        <div className="score-table-wrap">
          <table className="score-table final-wine-table">
            <caption className="sr-only">Az összes bor ára, alkoholfoka és a tetszés leíró statisztikái</caption>
            <thead><tr>
              <th scope="col">Hely</th><th scope="col">Bor</th><th scope="col">Ár</th><th scope="col">Alkohol</th>
              <th scope="col">Értékelés</th><th scope="col">Átlag</th><th scope="col">Szélsők nélkül</th><th scope="col">Medián</th><th scope="col">Szórás</th>
            </tr></thead>
            <tbody>{wines.map(({ wine, stats, rank }) => <tr key={wine.id} className={rank === 1 ? 'is-top' : undefined}>
              <td>{rank === null ? '—' : `${rank}.`}</td>
              <th scope="row">{label(wine.position, wine.name)}</th>
              <td>{wine.priceHuf.toLocaleString('hu-HU')} Ft</td>
              <td>{numeric(wine.alcoholTenths / 10)}%</td>
              <td>{stats.count}</td>
              <td><strong>{stat(stats.mean)}</strong></td>
              <td>{stat(stats.trimmedMean)}</td>
              <td>{stat(stats.median)}</td>
              <td>{stat(stats.spread)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="small-note">Tetszés 1–10 skálán, nem versenypont. A szélsők nélküli átlag a legmagasabb és a legalacsonyabb értéket hagyja ki (legalább 3 értékelésnél).</p>
      </section>
    </div>
  </section>;
}
