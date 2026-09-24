import type { Rating } from '../domain/game';
import { parseAlcohol } from '../games/model';

/** Form state as typed; converted to a `Rating` only on submit. */
export interface RatingDraft { priceBucket: string; alcohol: string; liking: string }

export const emptyDraft: RatingDraft = { priceBucket: '', alcohol: '', liking: '' };
/** Typical still wine; shown as placeholder and filled in on first touch. */
export const defaultAlcoholTenths = 120;
const halfDegree = 5;

export const formatAlcohol = (tenths: number) => (tenths / 10).toFixed(1).replace('.', ',');

export function draftFromRating(rating: Rating | null | undefined): RatingDraft {
  return rating ? { priceBucket: String(rating.priceBucket), alcohol: formatAlcohol(rating.alcoholTenths), liking: String(rating.liking) }
    : emptyDraft;
}

export function ratingFromDraft(draft: RatingDraft): Rating {
  return { priceBucket: draft.priceBucket ? Number(draft.priceBucket) : NaN, alcoholTenths: parseAlcohol(draft.alcohol),
    liking: draft.liking ? Number(draft.liking) : NaN };
}

/** Moves to the next half degree in the given direction; an empty or unreadable value starts at 12%. */
export function stepAlcohol(value: string, direction: 1 | -1): string {
  const current = parseAlcohol(value);
  if (!Number.isFinite(current)) return formatAlcohol(defaultAlcoholTenths + direction * halfDegree);
  const snapped = direction > 0 ? Math.floor(current / halfDegree) * halfDegree + halfDegree
    : Math.ceil(current / halfDegree) * halfDegree - halfDegree;
  return formatAlcohol(Math.min(250, Math.max(0, snapped)));
}
