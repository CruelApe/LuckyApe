import type { DataSource, GameRules, GameSlug, PickRange } from '@shared/types';

/** Rules for a game where the player chooses numbers (i.e. the generator applies). */
export type PickGameRules = GameRules & { kind: 'pick'; main: PickRange };

export function isPickGame(rules: GameRules): rules is PickGameRules {
  return rules.kind === 'pick' && rules.main !== null;
}

/** Strategies that choose individual numbers. `system` wraps one of these. */
export type Strategy = 'hot' | 'cold' | 'balanced' | 'bounce';
export type GeneratorMode = Strategy | 'system';

export interface NumberStat {
  number: number;
  /** Appearances as a main number in the analysed draws. */
  count: number;
  /** Exponentially decayed appearance score — recent draws weigh more. */
  recency: number;
  /** Draws since the number last appeared (0 = it was in the latest draw). */
  gap: number;
  /** `gap` divided by the expected gap (pool / pick); above 1 means "overdue". */
  overdueRatio: number;
}

export interface PoolStats {
  /** Index 0 is the number 1. */
  stats: NumberStat[];
  /** Sorted by recency, highest first. */
  hot: NumberStat[];
  /** Sorted by overdueRatio, highest first. */
  overdue: NumberStat[];
}

export interface OddEvenSplit {
  odd: number;
  even: number;
  /** Share of analysed draws with this split, 0..1. */
  share: number;
}

export interface SumRange {
  mean: number;
  stdev: number;
  /** 10th / 90th percentile — the "typical" band the balanced model targets. */
  low: number;
  high: number;
  /** True when derived from the draw history, false when it fell back to theory. */
  empirical: boolean;
}

export interface BounceStats {
  /** Supplementary (or Powerball) numbers that had a "next draw" to be checked against. */
  eligible: number;
  /** How many of those appeared among the next draw's main numbers. */
  hits: number;
  /** hits / eligible */
  rate: number;
  /** Chance a given number lands in a main draw by pure luck: pick / pool. */
  baseRate: number;
  /** rate / baseRate — about 1 means supplementaries carry no signal. */
  lift: number;
}

export interface GameAnalysis {
  slug: GameSlug;
  drawCount: number;
  main: PoolStats;
  powerball: PoolStats | null;
  oddEven: OddEvenSplit[];
  mostCommonSplit: OddEvenSplit | null;
  sum: SumRange;
  /** Distinct supplementary / Powerball numbers from the latest draws that fit the main pool. */
  carryCandidates: number[];
  bounce: BounceStats;
}

export type BadgeTone = 'hot' | 'cold' | 'positive' | 'neutral';

export interface Badge {
  id: string;
  label: string;
  tone: BadgeTone;
}

export interface GeneratedTicket {
  id: string;
  slug: GameSlug;
  mode: GeneratorMode;
  /** For `system` tickets, the strategy used to pick the numbers. */
  basedOn: Strategy | null;
  createdAt: string;
  numbers: number[];
  powerball: number | null;
  system: { size: number; games: number; powerHit: boolean } | null;
  badges: Badge[];
  drawsAnalysed: number;
  dataSource: DataSource;
}
