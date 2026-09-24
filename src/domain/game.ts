export type GameStatus = 'draft' | 'lobby' | 'tasting' | 'intermission' | 'reveal' | 'finished';
export type RoundStatus = 'pending' | 'open' | 'closed' | 'revealed';

export interface Rating {
  customAnswers?: Record<string,string>;
  /** 1-based index into `priceBuckets`; players guess a range, not an exact price. */
  priceBucket: number;
  alcoholTenths: number;
  liking: number;
}

/** Upper bounds are inclusive; the last bucket is open-ended. Kept in sync with `private.price_bucket`. */
export const priceBuckets = [
  { id: 1, label: '< 1 000 Ft', max: 1_000 },
  { id: 2, label: '1 001–2 000 Ft', max: 2_000 },
  { id: 3, label: '2 001–3 000 Ft', max: 3_000 },
  { id: 4, label: '3 001–4 000 Ft', max: 4_000 },
  { id: 5, label: '4 001–6 000 Ft', max: 6_000 },
  { id: 6, label: '6 001–8 000 Ft', max: 8_000 },
  { id: 7, label: '8 001–10 000 Ft', max: 10_000 },
  { id: 8, label: '10 000+ Ft', max: Infinity },
] as const;

export function priceBucketOf(priceHuf: number): number {
  return priceBuckets.find((bucket) => priceHuf <= bucket.max)!.id;
}
export function priceBucketLabel(bucket: number): string {
  return priceBuckets.find((item) => item.id === bucket)?.label ?? '–';
}

export interface WineTruth {
  name: string;
  priceHuf: number;
  alcoholTenths: number;
}

const transitions: Record<GameStatus, readonly GameStatus[]> = {
  draft: ['lobby'],
  lobby: ['tasting'],
  tasting: ['intermission'],
  intermission: ['tasting', 'reveal'],
  reveal: ['tasting', 'finished'],
  finished: [],
};

/** UI guard only. Production transitions must also enforce contextual DB rules. */
export function canTransition(from: GameStatus, to: GameStatus): boolean {
  return transitions[from].includes(to);
}

export function validateRating(rating: Rating): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(rating.priceBucket) || rating.priceBucket < 1 || rating.priceBucket > priceBuckets.length) {
    errors.push('Válassz egy árkategóriát.');
  }
  if (!Number.isInteger(rating.alcoholTenths) || rating.alcoholTenths < 0 || rating.alcoholTenths > 250) {
    errors.push('Az alkoholfok 0 és 25% között, 0,1-es lépésekben adható meg.');
  }
  if (!Number.isInteger(rating.liking) || rating.liking < 1 || rating.liking > 10) {
    errors.push('A tetszési index 1 és 10 közötti egész szám legyen.');
  }
  return errors;
}

export function scoreRating(rating: Rating, wine: WineTruth): number {
  if (validateRating(rating).length || !Number.isInteger(wine.priceHuf) || wine.priceHuf <= 0 ||
      wine.priceHuf > 1_000_000 || !Number.isInteger(wine.alcoholTenths) ||
      wine.alcoholTenths < 0 || wine.alcoholTenths > 250) {
    throw new Error('Érvénytelen pontozási bemenet.');
  }
  // Scoring version 2: full price points for the right bucket, half for a neighbouring one.
  const distance = Math.abs(rating.priceBucket - priceBucketOf(wine.priceHuf));
  const price = distance === 0 ? 50 : distance === 1 ? 25 : 0;
  const alcohol = 50 * Math.max(0, 1 - Math.abs(rating.alcoholTenths - wine.alcoholTenths) / 30);
  return Math.round(price + alcohol);
}

export function remainingSeconds(closesAt: number, now: number): number {
  return Math.max(0, Math.ceil((closesAt - now) / 1000));
}

export function canSubmit(status: RoundStatus, closesAt: number, now: number): boolean {
  return status === 'open' && now < closesAt;
}
