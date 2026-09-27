import type { GameResults, Scorecard } from './model';

export type ScoreLens = 'price' | 'alcohol' | 'questions';

export function categoryPoints(card: Scorecard, lens: ScoreLens): number {
  return card.wines.reduce((sum, wine) => {
    if (lens === 'price') return sum + (wine.pricePoints ?? 0);
    if (lens === 'alcohol') return sum + (wine.alcoholPoints ?? 0);
    return sum + wine.questions.reduce((points, question) => points + question.points, 0);
  }, 0);
}

export function categoryMax(results: GameResults, lens: ScoreLens): number {
  if (lens === 'questions') return results.scoringVersion === 3 ? results.wines.reduce((sum, wine) => sum + (wine.questions?.length ?? 0), 0) : 0;
  return results.scoringVersion === 3 ? results.revealedCount : results.revealedCount * 50;
}
