import type { Draw } from '@shared/types';

import type {
  BounceStats,
  GameAnalysis,
  NumberStat,
  OddEvenSplit,
  PickGameRules,
  PoolStats,
  SumRange,
} from './types';

export interface AnalysisOptions {
  /** Draws after which an appearance counts half as much. Default 40. */
  halfLife?: number;
  /** How many recent draws feed the supplementary carry-over candidates. Default 3. */
  carryLookback?: number;
}

const Z_P90 = 1.2815515655446004;

function buildPoolStats(
  pool: number,
  pick: number,
  history: number[][],
  halfLife: number,
): PoolStats {
  const decay = Math.pow(0.5, 1 / halfLife);
  const expectedGap = pool / pick;
  const stats: NumberStat[] = Array.from({ length: pool }, (_, i) => ({
    number: i + 1,
    count: 0,
    recency: 0,
    gap: history.length,
    overdueRatio: history.length / expectedGap,
  }));
  const seen = new Set<number>();

  // `history` is newest first, so the index is the age of the draw.
  history.forEach((numbers, age) => {
    for (const n of numbers) {
      const stat = stats[n - 1];
      if (!stat) continue;
      stat.count += 1;
      stat.recency += Math.pow(decay, age);
      if (!seen.has(n)) {
        seen.add(n);
        stat.gap = age;
        stat.overdueRatio = age / expectedGap;
      }
    }
  });

  return {
    stats,
    hot: [...stats].sort((a, b) => b.recency - a.recency || a.number - b.number),
    overdue: [...stats].sort((a, b) => b.overdueRatio - a.overdueRatio || a.number - b.number),
  };
}

function percentile(sortedAscending: number[], p: number): number {
  const position = (sortedAscending.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sortedAscending[lower] + (sortedAscending[upper] - sortedAscending[lower]) * fraction;
}

function buildSumRange(sums: number[], pick: number, pool: number): SumRange {
  // Theoretical mean/variance of the sum of `pick` distinct numbers from 1..pool.
  const theoryMean = (pick * (pool + 1)) / 2;
  const theoryStdev = Math.sqrt((pick * (pool + 1) * (pool - pick)) / 12);

  if (sums.length < 10) {
    return {
      mean: theoryMean,
      stdev: theoryStdev,
      low: Math.round(theoryMean - Z_P90 * theoryStdev),
      high: Math.round(theoryMean + Z_P90 * theoryStdev),
      empirical: false,
    };
  }
  const mean = sums.reduce((a, b) => a + b, 0) / sums.length;
  const variance = sums.reduce((a, b) => a + (b - mean) ** 2, 0) / sums.length;
  const sorted = [...sums].sort((a, b) => a - b);
  return {
    mean,
    stdev: Math.sqrt(variance),
    low: Math.round(percentile(sorted, 0.1)),
    high: Math.round(percentile(sorted, 0.9)),
    empirical: true,
  };
}

function buildOddEven(draws: Draw[], pick: number): OddEvenSplit[] {
  const counts = new Array<number>(pick + 1).fill(0);
  for (const draw of draws) {
    const odd = draw.main.filter((n) => n % 2 === 1).length;
    counts[odd] += 1;
  }
  return counts
    .map((count, odd) => ({
      odd,
      even: pick - odd,
      share: draws.length === 0 ? 0 : count / draws.length,
    }))
    .filter((split) => split.share > 0)
    .sort((a, b) => b.share - a.share);
}

/** The numbers a draw "hands on" to the next one: supplementaries, plus the Powerball when it fits. */
function carryOf(draw: Draw, pool: number): number[] {
  const carried = new Set<number>(draw.supplementary.filter((n) => n <= pool));
  if (draw.powerball !== null && draw.powerball <= pool) carried.add(draw.powerball);
  return [...carried];
}

function buildBounce(draws: Draw[], pick: number, pool: number): BounceStats {
  let eligible = 0;
  let hits = 0;
  // draws[i + 1] is the draw *before* draws[i], so it is the one whose carry we test.
  for (let i = 0; i + 1 < draws.length; i++) {
    const next = new Set(draws[i].main);
    for (const n of carryOf(draws[i + 1], pool)) {
      eligible += 1;
      if (next.has(n)) hits += 1;
    }
  }
  const rate = eligible === 0 ? 0 : hits / eligible;
  const baseRate = pick / pool;
  return { eligible, hits, rate, baseRate, lift: rate / baseRate };
}

/**
 * Summarise a draw history (newest first) for a pick-style game. Pure and synchronous:
 * a few hundred draws analyse in well under a millisecond.
 */
export function analyzeGame(
  rules: PickGameRules,
  draws: Draw[],
  options: AnalysisOptions = {},
): GameAnalysis {
  const { pick, pool } = rules.main;
  const halfLife = options.halfLife ?? 40;
  const carryLookback = options.carryLookback ?? 3;

  const main = buildPoolStats(pool, pick, draws.map((d) => d.main), halfLife);
  const powerball = rules.powerball
    ? buildPoolStats(
        rules.powerball.pool,
        1,
        draws.map((d) => (d.powerball === null ? [] : [d.powerball])),
        halfLife,
      )
    : null;

  const oddEven = buildOddEven(draws, pick);
  const carryCandidates = [
    ...new Set(draws.slice(0, carryLookback).flatMap((draw) => carryOf(draw, pool))),
  ].sort((a, b) => a - b);

  return {
    slug: rules.slug,
    drawCount: draws.length,
    main,
    powerball,
    oddEven,
    mostCommonSplit: oddEven[0] ?? null,
    sum: buildSumRange(
      draws.map((d) => d.main.reduce((a, b) => a + b, 0)),
      pick,
      pool,
    ),
    carryCandidates,
    bounce: buildBounce(draws, pick, pool),
  };
}
