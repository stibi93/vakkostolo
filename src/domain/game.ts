export type GameStatus = 'draft' | 'lobby' | 'tasting' | 'intermission' | 'reveal' | 'finished';
export type RoundStatus = 'pending' | 'open' | 'closed' | 'revealed';

export interface Rating {
  priceHuf: number;
  alcoholTenths: number;
  liking: number;
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
  if (!Number.isInteger(rating.priceHuf) || rating.priceHuf < 0 || rating.priceHuf > 1_000_000) {
    errors.push('Az ár 0 és 1 000 000 Ft közötti egész szám legyen.');
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
  const price = 50 * Math.max(0, 1 - Math.abs(rating.priceHuf - wine.priceHuf) / wine.priceHuf);
  const alcohol = 50 * Math.max(0, 1 - Math.abs(rating.alcoholTenths - wine.alcoholTenths) / 30);
  return Math.round(price + alcohol);
}

export function remainingSeconds(closesAt: number, now: number): number {
  return Math.max(0, Math.ceil((closesAt - now) / 1000));
}

export function canSubmit(status: RoundStatus, closesAt: number, now: number): boolean {
  return status === 'open' && now < closesAt;
}

/** Contiguous unrevealed block; a short last block can be revealed too. */
export function revealableIndexes(statuses: readonly RoundStatus[], every: number): number[] {
  if (!Number.isInteger(every) || every < 1) throw new Error('Érvénytelen blokkbeállítás.');
  const start = statuses.findIndex((status) => status !== 'revealed');
  if (start === -1) return [];
  const end = Math.min(start + every, statuses.length);
  const block = statuses.slice(start, end);
  return block.every((status) => status === 'closed') ? block.map((_, i) => start + i) : [];
}
