/** No names, user IDs, raw guesses or unrevealed wine data cross this boundary. */
export interface RevealedSummaryInput {
  allRoundsRevealed: boolean;
  participantCount: number;
  wines: readonly {
    label: string;
    responseCount: number;
    meanLiking: number | null;
  }[];
}

export interface SummaryProvider {
  summarize(input: RevealedSummaryInput): Promise<string>;
}

export const runtimeAiEnabled = false;

/** Zero-cost baseline. Future AI integration must preserve this fallback. */
export function summarizeWithoutAi(input: RevealedSummaryInput): string {
  if (!input.allRoundsRevealed) throw new Error('Összefoglaló csak teljes felfedés után készülhet.');
  if (!Number.isInteger(input.participantCount) || input.participantCount < 0 ||
      input.wines.some((wine) => !Number.isInteger(wine.responseCount) || wine.responseCount < 0 ||
        wine.responseCount > input.participantCount ||
        (wine.responseCount === 0 ? wine.meanLiking !== null :
          wine.meanLiking === null || !Number.isFinite(wine.meanLiking) || wine.meanLiking < 1 || wine.meanLiking > 10))) {
    throw new Error('Érvénytelen összesített eredmény.');
  }
  const rated = input.wines.filter((wine) => wine.meanLiking !== null);
  if (!rated.length) return 'Még nincs beküldött értékelés.';
  const best = Math.max(...rated.map((wine) => wine.meanLiking!));
  const favorites = rated.filter((wine) => wine.meanLiking === best).map((wine) => wine.label).join(', ');
  return `${input.participantCount} játékos, ${input.wines.length} bor. Legmagasabb tetszési átlag: ${favorites} (${best.toLocaleString('hu-HU', { maximumFractionDigits: 1 })}/10).`;
}
