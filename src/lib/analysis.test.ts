import { BUILTIN_RULES } from '@shared/games';
import type { Draw } from '@shared/types';
import { describe, expect, it } from 'vitest';

import { analyzeGame } from './analysis';
import type { PickGameRules } from './types';

/** A tiny game (3 from 10) so expected values can be worked out by hand. */
const MINI: PickGameRules = {
  ...BUILTIN_RULES.tattslotto,
  kind: 'pick',
  main: { pick: 3, pool: 10 },
};

const draw = (main: number[], supplementary: number[] = [], powerball: number | null = null): Draw => ({
  drawNumber: null,
  date: '2026-01-01',
  main,
  supplementary,
  powerball,
});

describe('analyzeGame', () => {
  // newest first
  const draws = [draw([1, 2, 3]), draw([1, 2, 4]), draw([1, 5, 6])];
  const analysis = analyzeGame(MINI, draws);

  it('counts appearances and tracks gaps', () => {
    const stat = (n: number) => analysis.main.stats[n - 1];
    expect(stat(1).count).toBe(3);
    expect(stat(1).gap).toBe(0);
    expect(stat(4).count).toBe(1);
    expect(stat(4).gap).toBe(1);
    expect(stat(7).count).toBe(0);
    expect(stat(7).gap).toBe(3); // never seen: as long as the history
  });

  it('computes overdue ratio against the expected gap (pool / pick)', () => {
    expect(analysis.main.stats[6].overdueRatio).toBeCloseTo(3 / (10 / 3));
    expect(analysis.main.overdue[0].overdueRatio).toBeGreaterThanOrEqual(
      analysis.main.overdue[1].overdueRatio,
    );
  });

  it('ranks hot numbers by decayed recency', () => {
    expect(analysis.main.hot[0].number).toBe(1);
    const recency = (n: number) => analysis.main.stats[n - 1].recency;
    expect(recency(3)).toBeGreaterThan(recency(4)); // 3 is in the newest draw, 4 one draw older
  });

  it('reports the odd/even distribution', () => {
    // [1,2,3] -> 2 odd, [1,2,4] -> 1 odd, [1,5,6] -> 2 odd
    expect(analysis.mostCommonSplit).toMatchObject({ odd: 2, even: 1 });
    expect(analysis.mostCommonSplit!.share).toBeCloseTo(2 / 3);
    expect(analysis.oddEven.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
  });

  it('falls back to theory for the sum band when the history is short', () => {
    expect(analysis.sum.empirical).toBe(false);
    expect(analysis.sum.mean).toBeCloseTo((3 * 11) / 2);
    expect(analysis.sum.low).toBeLessThan(analysis.sum.mean);
    expect(analysis.sum.high).toBeGreaterThan(analysis.sum.mean);
  });

  it('uses the empirical sum band once there are enough draws', () => {
    const many = Array.from({ length: 20 }, (_, i) => draw([1 + (i % 3), 4 + (i % 2), 8]));
    const result = analyzeGame(MINI, many);
    expect(result.sum.empirical).toBe(true);
    expect(result.sum.low).toBeLessThanOrEqual(result.sum.high);
  });

  it('measures how often supplementaries bounce into the next draw', () => {
    // older draw carried 1 and 9 as supplementaries; the next draw (newer) has 1 as a main number.
    const bounce = analyzeGame(MINI, [draw([1, 2, 3]), draw([4, 5, 6], [1, 9])]).bounce;
    expect(bounce.eligible).toBe(2);
    expect(bounce.hits).toBe(1);
    expect(bounce.rate).toBeCloseTo(0.5);
    expect(bounce.baseRate).toBeCloseTo(0.3);
    expect(bounce.lift).toBeCloseTo(0.5 / 0.3);
  });

  it('collects recent carry-over candidates and ignores numbers outside the pool', () => {
    const result = analyzeGame(MINI, [draw([1, 2, 3], [9, 12]), draw([4, 5, 6], [9, 7])]);
    expect(result.carryCandidates).toEqual([7, 9]);
  });

  it('analyses the Powerball barrel separately', () => {
    const rules = BUILTIN_RULES.powerball as PickGameRules;
    const result = analyzeGame(rules, [
      draw([1, 2, 3, 4, 5, 6, 7], [], 20),
      draw([8, 9, 10, 11, 12, 13, 14], [], 20),
    ]);
    expect(result.powerball!.stats).toHaveLength(20);
    expect(result.powerball!.stats[19].count).toBe(2);
    expect(result.powerball!.hot[0].number).toBe(20);
    // a Powerball number can carry over into the main barrel when it fits (<= 35)
    expect(result.carryCandidates).toEqual([20]);
  });

  it('copes with an empty history', () => {
    const result = analyzeGame(MINI, []);
    expect(result.drawCount).toBe(0);
    expect(result.mostCommonSplit).toBeNull();
    expect(result.bounce.eligible).toBe(0);
    expect(result.main.stats.every((s) => s.count === 0)).toBe(true);
  });
});
