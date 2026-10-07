import { expect, it } from 'vitest';
import { rankWines } from '../src/results/wineRanking';
import type { WineResult } from '../src/results/model';
const histogram = (...scores: number[]) => scores.reduce((counts, score) => { counts[score - 1]++; return counts; }, Array<number>(10).fill(0));
const wine = (position: number, ...scores: number[]) => ({ id: String(position), position, name: `Bor ${position}`, priceHuf: 5000, priceBucket: 5, alcoholTenths: 130,
  photoUpdatedAt: null, responseCount: scores.length, averageLiking: null, own: null, guesses: { price: [], alcohol: [], liking: histogram(...scores) } }) as WineResult;

it('a borokat átlagos tetszés szerint rangsorolja, azonos átlag azonos helyezés, értékelés nélküli bor a végén', () => {
  const ranked = rankWines([wine(1, 5, 7), wine(2), wine(3, 9, 8), wine(4, 6, 6), wine(5, 4, 8, 6)]);
  expect(ranked.map(row => [row.wine.position, row.rank])).toEqual([[3, 1], [1, 2], [4, 2], [5, 2], [2, null]]);
});
