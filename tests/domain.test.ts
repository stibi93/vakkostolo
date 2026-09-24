import { describe, expect, it } from 'vitest';
import { canSubmit, canTransition, remainingSeconds, revealableIndexes, scoreRating, validateRating } from '../src/domain/game';
import { summarizeWithoutAi } from '../src/ai/summary';

const wine = { name: 'Tesztbor', priceHuf: 5000, alcoholTenths: 135 };
const rating = { priceHuf: 6000, alcoholTenths: 140, liking: 7 };

describe('pontozás és validáció', () => {
  it('a dokumentált példát számolja, a tetszés nem változtat pontot', () => {
    expect(scoreRating(rating, wine)).toBe(82);
    expect(scoreRating({ ...rating, liking: 1 }, wine)).toBe(82);
    expect(scoreRating({ ...wine, liking: 10 }, wine)).toBe(100);
  });
  it('nagy hibánál is 0–100 közötti marad', () => {
    expect(scoreRating({ priceHuf: 10000, alcoholTenths: 165, liking: 1 }, wine)).toBe(0);
    expect(scoreRating({ priceHuf: 0, alcoholTenths: 0, liking: 1 }, wine)).toBe(0);
  });
  it.each([NaN, Infinity, -1, 1_000_001, 0.5])('tiltott ár: %s', (priceHuf) => {
    expect(validateRating({ ...rating, priceHuf })).not.toHaveLength(0);
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
