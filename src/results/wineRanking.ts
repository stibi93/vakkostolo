import { likingStats } from './likingStats';
import type { LikingStats } from './likingStats';
import type { WineResult } from './model';

export interface RankedWine { wine: WineResult; stats: LikingStats; rank: number | null }

/** Wines by average liking, best first; equal averages share a rank, unrated wines come last without one. */
export function rankWines(wines: WineResult[]): RankedWine[] {
  const rows = wines.map(wine => ({ wine, stats: likingStats(wine.guesses.liking) }))
    .sort((a, b) => (b.stats.mean ?? -1) - (a.stats.mean ?? -1) || (b.stats.median ?? -1) - (a.stats.median ?? -1) || a.wine.position - b.wine.position);
  return rows.map((row, index) => {
    if (row.stats.mean === null) return { ...row, rank: null };
    const first = rows.findIndex(other => other.stats.mean === row.stats.mean);
    return { ...row, rank: (first === -1 ? index : first) + 1 };
  });
}
