import { formatInt } from '@shared/format';

import type { Badge, GameAnalysis, GeneratorMode, PickGameRules } from './types';
import { parityBand } from './balanced';

/** Fewer draws than this and "hot"/"overdue" labels would mostly be noise, so they are skipped. */
const MIN_DRAWS_FOR_LABELS = 10;
const OVERDUE_THRESHOLD = 1.5;

export interface BadgeContext {
  mode: GeneratorMode;
  /** Set for System entries: the number of standard games the entry covers. */
  systemGames?: number;
  /** True when the balanced model had to loosen its filters to find a ticket. */
  relaxed?: boolean;
}

/**
 * Describe what is *actually true* of a set of numbers, regardless of how it was generated.
 * Badges are facts about the numbers (e.g. "3 hot"), not claims about the algorithm.
 */
export function buildBadges(
  rules: PickGameRules,
  analysis: GameAnalysis,
  numbers: number[],
  context: BadgeContext,
): Badge[] {
  const { pool } = rules.main;
  const badges: Badge[] = [];

  if (context.systemGames !== undefined) {
    badges.push({ id: 'games', label: `${formatInt(context.systemGames)} games`, tone: 'positive' });
  }

  if (analysis.drawCount >= MIN_DRAWS_FOR_LABELS) {
    const hotCutoff = new Set(analysis.main.hot.slice(0, Math.ceil(pool / 4)).map((s) => s.number));
    const hot = numbers.filter((n) => hotCutoff.has(n)).length;
    if (hot > 0) badges.push({ id: 'hot', label: `${hot} hot`, tone: 'hot' });

    const overdue = numbers.filter(
      (n) => (analysis.main.stats[n - 1]?.overdueRatio ?? 0) >= OVERDUE_THRESHOLD,
    ).length;
    if (overdue > 0) badges.push({ id: 'overdue', label: `${overdue} overdue`, tone: 'cold' });
  }

  const odd = numbers.filter((n) => n % 2 === 1).length;
  const band = parityBand(numbers.length);
  badges.push({
    id: 'parity',
    label: `${odd} odd · ${numbers.length - odd} even`,
    tone: odd >= band.oddMin && odd <= band.oddMax ? 'positive' : 'neutral',
  });

  // Sum is only comparable to the history for a standard-size ticket.
  if (numbers.length === rules.main.pick) {
    const total = numbers.reduce((a, b) => a + b, 0);
    badges.push({
      id: 'sum',
      label: `Sum ${total}`,
      tone: total >= analysis.sum.low && total <= analysis.sum.high ? 'positive' : 'neutral',
    });
  }

  const carried = numbers.filter((n) => analysis.carryCandidates.includes(n)).length;
  if (carried > 0) {
    badges.push({ id: 'carry', label: `${carried} carry-over`, tone: 'neutral' });
  }

  const low = numbers.filter((n) => n <= pool / 2).length;
  badges.push({ id: 'spread', label: `${low} low · ${numbers.length - low} high`, tone: 'neutral' });

  if (context.relaxed) badges.push({ id: 'relaxed', label: 'Filters relaxed', tone: 'neutral' });
  return badges;
}
