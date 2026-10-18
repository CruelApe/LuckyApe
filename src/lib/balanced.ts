import type { SumRange } from './types';

export interface BalanceConstraints {
  /** Allowed count of odd numbers, inclusive. */
  oddMin: number;
  oddMax: number;
  /** Allowed sum band, inclusive. Skipped when null. */
  sum: { low: number; high: number } | null;
  /** Longest allowed run of consecutive numbers (e.g. 5,6,7 is a run of 3). */
  maxRun: number | null;
  /** Most numbers allowed from one block of ten (1–10, 11–20, ...). */
  maxPerDecade: number | null;
}

/** Odd counts within one of an even split (6 numbers: 2, 3 or 4; 7 numbers: 3 or 4). */
export function parityBand(pick: number): { oddMin: number; oddMax: number } {
  const centre = pick / 2;
  const allowed = Array.from({ length: pick + 1 }, (_, odd) => odd).filter(
    (odd) => Math.abs(odd - centre) <= 1,
  );
  return { oddMin: Math.min(...allowed), oddMax: Math.max(...allowed) };
}

/**
 * Constraint sets from strictest to loosest. The generator walks down the list if the strict
 * set is too tight to satisfy, and reports that it relaxed.
 */
export function balanceLevels(pick: number, sum: SumRange): BalanceConstraints[] {
  const parity = parityBand(pick);
  const band = { low: sum.low, high: sum.high };
  return [
    { ...parity, sum: band, maxRun: 2, maxPerDecade: Math.ceil(pick / 2) },
    { ...parity, sum: band, maxRun: null, maxPerDecade: null },
    { ...parity, sum: null, maxRun: null, maxPerDecade: null },
  ];
}

function longestRun(sortedAscending: number[]): number {
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sortedAscending.length; i++) {
    current = sortedAscending[i] === sortedAscending[i - 1] + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return sortedAscending.length === 0 ? 0 : longest;
}

export function satisfies(numbers: number[], c: BalanceConstraints): boolean {
  const sorted = [...numbers].sort((a, b) => a - b);
  const odd = sorted.filter((n) => n % 2 === 1).length;
  if (odd < c.oddMin || odd > c.oddMax) return false;

  if (c.sum) {
    const total = sorted.reduce((a, b) => a + b, 0);
    if (total < c.sum.low || total > c.sum.high) return false;
  }
  if (c.maxRun !== null && longestRun(sorted) > c.maxRun) return false;
  if (c.maxPerDecade !== null) {
    const perDecade = new Map<number, number>();
    for (const n of sorted) {
      const decade = Math.floor((n - 1) / 10);
      perDecade.set(decade, (perDecade.get(decade) ?? 0) + 1);
    }
    if ([...perDecade.values()].some((v) => v > (c.maxPerDecade as number))) return false;
  }
  return true;
}
