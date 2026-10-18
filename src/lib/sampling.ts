import type { Rng } from '@shared/rng';

/**
 * Weighted sampling without replacement (Efraimidis–Spirakis).
 * `weights[i]` is the weight of the number `i + 1`; zero/negative weights are never picked
 * unless there are not enough positive-weight numbers to fill `count`.
 * Returns the picked numbers sorted ascending.
 */
export function sampleDistinct(
  weights: readonly number[],
  count: number,
  rng: Rng,
  excluded: ReadonlySet<number> = new Set(),
): number[] {
  const keyed: { number: number; key: number }[] = [];
  for (let i = 0; i < weights.length; i++) {
    const number = i + 1;
    if (excluded.has(number)) continue;
    const weight = weights[i];
    // ln(u) / w is a monotonic stand-in for u^(1/w) that avoids underflow.
    const key = weight > 0 ? Math.log(1 - rng()) / weight : Number.NEGATIVE_INFINITY;
    keyed.push({ number, key });
  }
  if (keyed.length < count) {
    throw new RangeError(`Cannot pick ${count} distinct numbers from ${keyed.length} candidates`);
  }
  return keyed
    .sort((a, b) => b.key - a.key || a.number - b.number)
    .slice(0, count)
    .map((k) => k.number)
    .sort((a, b) => a - b);
}

/** Pick one number by weight; same semantics as `sampleDistinct(weights, 1, rng)`. */
export function sampleOne(weights: readonly number[], rng: Rng): number {
  return sampleDistinct(weights, 1, rng)[0];
}
