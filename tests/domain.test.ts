import { describe, expect, it } from 'vitest';
import { canSubmit, canTransition, priceBucketOf, priceBuckets, remainingSeconds, revealableIndexes, scoreRating, validateRating } from '../src/domain/game';
import { summarizeWithoutAi } from '../src/ai/summary';

const wine = { name: 'Tesztbor', priceHuf: 5000, alcoholTenths: 135 };
const rating = { priceBucket: 6, alcoholTenths: 140, liking: 7 };

describe('árkategóriák', () => {
  it('a felső határ a kategóriába tartozik, a 10 000 Ft feletti ár az utolsóba', () => {
    expect([0, 1000, 1001, 2000, 2001, 4000, 4001, 6000, 6001, 8000, 8001, 10000, 10001, 1_000_000].map(priceBucketOf))
      .toEqual([1, 1, 2, 2, 3, 4, 5, 5, 6, 6, 7, 7, 8, 8]);
    expect(priceBuckets.map((bucket) => bucket.label)).toEqual(['< 1 000 Ft', '1 001–2 000 Ft', '2 001–3 000 Ft',
      '3 001–4 000 Ft', '4 001–6 000 Ft', '6 001–8 000 Ft', '8 001–10 000 Ft', '10 000+ Ft']);
  });
});

describe('pontozás (2. verzió) és validáció', () => {
  it('pontos kategória 50, szomszédos 25 árpont; a tetszés nem változtat pontot', () => {
    expect(scoreRating({ ...rating, priceBucket: 5, alcoholTenths: 135 }, wine)).toBe(100);
    expect(scoreRating(rating, wine)).toBe(67);
    expect(scoreRating({ ...rating, liking: 1 }, wine)).toBe(67);
    expect(scoreRating({ ...rating, priceBucket: 7, alcoholTenths: 135 }, wine)).toBe(50);
  });
  it('nagy hibánál is 0–100 közötti marad', () => {
    expect(scoreRating({ priceBucket: 8, alcoholTenths: 165, liking: 1 }, wine)).toBe(0);
    expect(scoreRating({ priceBucket: 1, alcoholTenths: 0, liking: 1 }, wine)).toBe(0);
  });
  it.each([NaN, Infinity, 0, 9, 1.5])('tiltott árkategória: %s', (priceBucket) => {
    expect(validateRating({ ...rating, priceBucket })).not.toHaveLength(0);
  });
  it('tiltja az érvénytelen alkoholt és tetszést', () => {
    expect(validateRating({ ...rating, alcoholTenths: 251, liking: 0 })).toHaveLength(2);
    expect(() => scoreRating(rating, { ...wine, priceHuf: 0 })).toThrow();
  });
});

describe('körök és határidő', () => {
  it('a határidő pillanatában már nem fogad választ', () => {
    expect(canSubmit('open', 2000, 1999)).toBe(true);
    expect(canSubmit('open', 2000, 2000)).toBe(false);
    expect(canSubmit('closed', 2000, 1000)).toBe(false);
    expect(remainingSeconds(2000, 2500)).toBe(0);
  });
  it('tiltja a lezárt játék újraindítását és a kóstolás közbeni felfedést', () => {
    expect(canTransition('finished', 'tasting')).toBe(false);
    expect(canTransition('tasting', 'reveal')).toBe(false);
    expect(canTransition('lobby', 'tasting')).toBe(true);
  });
  it('csak teljesen lezárt blokkot fed fel, az utolsó töredékblokkot is', () => {
    expect(revealableIndexes(['closed', 'open', 'pending'], 2)).toEqual([]);
    expect(revealableIndexes(['closed', 'closed', 'pending'], 2)).toEqual([0, 1]);
    expect(revealableIndexes(['revealed', 'revealed', 'closed'], 2)).toEqual([2]);
    expect(revealableIndexes(['revealed'], 2)).toEqual([]);
    expect(() => revealableIndexes(['closed'], 0)).toThrow();
  });
});

describe('AI nélküli összegzés', () => {
  it('nem összegzi a még rejtett kóstolót', () => {
    expect(() => summarizeWithoutAi({ allRoundsRevealed: false, participantCount: 1, wines: [] })).toThrow();
  });
  it('a hiányzó válasz nem válik nulla kedveltséggé', () => {
    expect(summarizeWithoutAi({ allRoundsRevealed: true, participantCount: 1,
      wines: [{ label: '01', responseCount: 0, meanLiking: null }] })).toContain('nincs');
  });
  it('holtversenyben minden kedvencet megnevez', () => {
    const result = summarizeWithoutAi({ allRoundsRevealed: true, participantCount: 2,
      wines: ['A', 'B'].map((label) => ({ label, responseCount: 2, meanLiking: 8 })) });
    expect(result).toContain('A, B');
  });
});
