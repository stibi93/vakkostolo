import { describe, expect, it } from 'vitest';
import { draftFromRating, emptyDraft, formatAlcohol, ratingFromDraft, stepAlcohol } from '../src/rating/draft';

describe('alkoholléptető', () => {
  it('üres vagy olvashatatlan értéknél 12%-ról indul', () => {
    expect(stepAlcohol('', 1)).toBe('12,5');
    expect(stepAlcohol('', -1)).toBe('11,5');
    expect(stepAlcohol('abc', 1)).toBe('12,5');
  });
  it('fél fokonként lép, a köztes értéket a következő félre igazítja', () => {
    expect(stepAlcohol('12,0', 1)).toBe('12,5');
    expect(stepAlcohol('12,5', -1)).toBe('12,0');
    expect(stepAlcohol('12,3', 1)).toBe('12,5');
    expect(stepAlcohol('12,3', -1)).toBe('12,0');
    expect(stepAlcohol('13.7', 1)).toBe('14,0');
  });
  it('0 és 25% között marad', () => {
    expect(stepAlcohol('0,0', -1)).toBe('0,0');
    expect(stepAlcohol('25,0', 1)).toBe('25,0');
  });
  it('mindig egy tizedesjeggyel, vesszővel formáz', () => {
    expect(formatAlcohol(120)).toBe('12,0');
    expect(formatAlcohol(135)).toBe('13,5');
  });
});

describe('piszkozat és tipp', () => {
  it('oda-vissza alakítás megőrzi a kategóriát, az alkoholt és a tetszést', () => {
    const rating = { priceBucket: 5, alcoholTenths: 135, liking: 8 };
    expect(draftFromRating(rating)).toEqual({ priceBucket: '5', alcohol: '13,5', liking: '8' });
    expect(ratingFromDraft(draftFromRating(rating))).toEqual(rating);
  });
  it('hiányzó mező NaN, így a validáció elutasítja; a helyőrző nem számít értéknek', () => {
    expect(draftFromRating(null)).toEqual(emptyDraft);
    const rating = ratingFromDraft(emptyDraft);
    expect([rating.priceBucket, rating.alcoholTenths, rating.liking].every(Number.isNaN)).toBe(true);
  });
});
