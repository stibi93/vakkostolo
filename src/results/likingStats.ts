export interface LikingStats { count: number; mean: number | null; trimmedMean: number | null; median: number | null; spread: number | null }

/** Statistics from the 1–10 liking histogram (index 0 is score 1). The trimmed mean drops one highest and one lowest score. */
export function likingStats(histogram: number[]): LikingStats {
  const scores = histogram.flatMap((count, index) => Array<number>(count).fill(index + 1));
  const count = scores.length;
  if (!count) return { count, mean: null, trimmedMean: null, median: null, spread: null };
  const sum = scores.reduce((total, score) => total + score, 0);
  const mean = sum / count;
  const middle = Math.floor(count / 2);
  const median = count % 2 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2;
  const trimmedMean = count >= 3 ? (sum - scores[0] - scores[count - 1]) / (count - 2) : null;
  const spread = Math.sqrt(scores.reduce((total, score) => total + (score - mean) ** 2, 0) / count);
  return { count, mean, trimmedMean, median, spread };
}
