import { expect, it } from 'vitest';
import { likingStats } from '../src/results/likingStats';
const histogram = (...scores: number[]) => scores.reduce((counts, score) => { counts[score - 1]++; return counts; }, Array<number>(10).fill(0));

it('a tetszés statisztikái a hisztogramból számolódnak', () => {
  const stats = likingStats(histogram(2, 7, 8, 8, 10));
  expect(stats).toMatchObject({ count: 5, mean: 7, median: 8 });
  expect(stats.trimmedMean).toBeCloseTo(23 / 3);
  expect(stats.spread).toBeCloseTo(Math.sqrt(36 / 5));
});
it('páros elemszámnál a medián a két középső átlaga', () => {
  expect(likingStats(histogram(3, 4, 6, 9)).median).toBe(5);
});
it('három értékelés alatt nincs nyesett átlag, értékelés nélkül nincs statisztika', () => {
  expect(likingStats(histogram(4, 6))).toMatchObject({ count: 2, mean: 5, trimmedMean: null, median: 5, spread: 1 });
  expect(likingStats(Array<number>(10).fill(0))).toEqual({ count: 0, mean: null, trimmedMean: null, median: null, spread: null });
});
