import type { PoolStats } from './types';

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

/**
 * "Hot" weights: decayed appearance score, smoothed so a number that has never appeared
 * still has a small chance, then sharpened by `intensity` (1 = proportional, 2 = strongly biased).
 */
export function hotWeights(pool: PoolStats, intensity = 1.5): number[] {
  const smoothing = 0.5 * mean(pool.stats.map((s) => s.recency)) + 1e-6;
  return pool.stats.map((s) => Math.pow(s.recency + smoothing, intensity));
}

/**
 * "Cold / overdue" weights: how long a number has been missing, discounted for numbers that are
 * rare overall. This is the inverse of the hot strategy rather than a mirror of it, because a
 * number that missed the last draw is not "cold" — one that has been absent for a while is.
 */
export function coldWeights(pool: PoolStats, intensity = 1.5): number[] {
  const averageCount = mean(pool.stats.map((s) => s.count));
  return pool.stats.map((s) => {
    const overdue = s.overdueRatio + 0.1;
    const scarcity = averageCount === 0 ? 1 : 1 / (s.count / averageCount + 0.5);
    return Math.pow(overdue * scarcity, intensity);
  });
}

export function flatWeights(poolSize: number): number[] {
  return new Array<number>(poolSize).fill(1);
}
