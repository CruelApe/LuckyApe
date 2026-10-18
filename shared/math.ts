/** Binomial coefficient C(n, k) — exact for the sizes used by lottery games. */
export function combinations(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0) {
    throw new RangeError(`combinations(${n}, ${k}) requires non-negative integers`);
  }
  if (k > n) return 0;
  const m = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= m; i++) {
    // Multiplying before dividing keeps every intermediate value an exact integer.
    result = (result * (n - m + i)) / i;
  }
  return Math.round(result);
}
