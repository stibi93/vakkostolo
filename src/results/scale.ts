import type { GuessCount } from './model';

/** Half-percent ticks covering every guess and the true alcohol, including empty steps between them. */
export function alcoholScale(points: GuessCount[], truthTenths: number): GuessCount[] {
  const present = new Map(points.map(point => [point.tenths, point.count]));
  const values = [truthTenths, ...points.map(point => point.tenths)];
  const start = Math.floor(Math.min(...values) / 5) * 5;
  const end = Math.ceil(Math.max(...values) / 5) * 5;
  const scale: GuessCount[] = [];
  for (let tenths = start; tenths <= end; tenths += 5) scale.push({ tenths, count: present.get(tenths) ?? 0 });
  return scale;
}
