import { describe, expect, it } from 'vitest';

import { BUILTIN_RULES, GAME_LIST, isGameSlug } from './games';
import { combinations } from './math';
import { generateSampleSnapshot } from './sample';
import { GAME_SLUGS } from './types';

const NOW = new Date('2026-10-18T09:00:00Z'); // a Sunday

describe('combinations', () => {
  it('matches known lottery totals', () => {
    expect(combinations(45, 6)).toBe(8_145_060);
    expect(combinations(47, 7)).toBe(62_891_499);
    expect(combinations(35, 7) * 20).toBe(134_490_400);
  });

  it('handles edges and rejects bad input', () => {
    expect(combinations(5, 0)).toBe(1);
    expect(combinations(5, 5)).toBe(1);
    expect(combinations(3, 5)).toBe(0);
    expect(() => combinations(-1, 2)).toThrow(RangeError);
    expect(() => combinations(5, 1.5)).toThrow(RangeError);
  });
});

describe('built-in rules', () => {
  it('cover every slug exactly once, in order', () => {
    expect(GAME_LIST.map((g) => g.slug)).toEqual([...GAME_SLUGS]);
    expect(isGameSlug('powerball')).toBe(true);
    expect(isGameSlug('keno')).toBe(false);
  });

  it('have a Division 1 whose odds equal the combinatorics of the game', () => {
    for (const rules of GAME_LIST.filter((g) => g.kind === 'pick')) {
      const { pick, pool } = rules.main!;
      const total = combinations(pool, pick) * (rules.powerball?.pool ?? 1);
      expect(rules.divisions[0].oddsOneIn, rules.name).toBe(total);
    }
  });

  it('have supplementary divisions consistent with the hypergeometric odds (TattsLotto)', () => {
    const total = combinations(45, 6);
    const [, d2, d3] = BUILTIN_RULES.tattslotto.divisions;
    // 5 main + 1 of the 2 supplementaries
    expect(Math.abs(d2.oddsOneIn - total / (6 * 2))).toBeLessThanOrEqual(1);
    // 5 main + 1 number that is neither main nor supplementary (37 left)
    expect(Math.abs(d3.oddsOneIn - total / (6 * 37))).toBeLessThanOrEqual(1);
  });

  it('only allow System entries on pick games, and PowerHit only on Powerball', () => {
    for (const rules of GAME_LIST) {
      if (rules.kind === 'allocated') {
        expect(rules.system).toBeNull();
        expect(rules.allocatedNote).toBeTruthy();
      } else {
        expect(rules.system!.min).toBeGreaterThan(rules.main!.pick - 1);
        expect(rules.system!.max).toBeLessThanOrEqual(20);
      }
      expect(rules.powerHitSystem === null).toBe(rules.slug !== 'powerball');
    }
  });
});

describe('generateSampleSnapshot', () => {
  it('is deterministic for a given date', () => {
    const a = generateSampleSnapshot(BUILTIN_RULES['oz-lotto'], { now: NOW });
    const b = generateSampleSnapshot(BUILTIN_RULES['oz-lotto'], { now: NOW });
    expect(a.draws).toEqual(b.draws);
  });

  it('is labelled as sample data and never invents a jackpot', () => {
    for (const rules of GAME_LIST) {
      const snapshot = generateSampleSnapshot(rules, { now: NOW });
      expect(snapshot.source).toBe('sample');
      expect(snapshot.jackpot).toBeNull();
    }
  });

  it('produces newest-first draws on the scheduled weekdays only', () => {
    const snapshot = generateSampleSnapshot(BUILTIN_RULES['weekday-windfall'], { now: NOW, draws: 30 });
    expect(snapshot.draws).toHaveLength(30);
    const days = snapshot.draws.map((d) => new Date(`${d.date}T00:00:00Z`).getUTCDay());
    expect(new Set(days)).toEqual(new Set([1, 3, 5])); // Mon, Wed, Fri
    for (let i = 1; i < snapshot.draws.length; i++) {
      expect(snapshot.draws[i - 1].date > snapshot.draws[i].date).toBe(true);
    }
    // The latest scheduled day before Sunday 18 Oct 2026 is Friday 16 Oct.
    expect(snapshot.draws[0].date).toBe('2026-10-16');
  });

  it('draws valid, distinct numbers within each game pool', () => {
    for (const rules of GAME_LIST.filter((g) => g.kind === 'pick')) {
      const { pick, pool } = rules.main!;
      for (const draw of generateSampleSnapshot(rules, { now: NOW }).draws) {
        expect(draw.main).toHaveLength(pick);
        expect(draw.supplementary).toHaveLength(rules.supplementaries);
        const all = [...draw.main, ...draw.supplementary];
        expect(new Set(all).size).toBe(all.length);
        expect(Math.min(...all)).toBeGreaterThanOrEqual(1);
        expect(Math.max(...all)).toBeLessThanOrEqual(pool);
        expect([...draw.main].sort((a, b) => a - b)).toEqual(draw.main);
        if (rules.powerball) {
          expect(draw.powerball).toBeGreaterThanOrEqual(1);
          expect(draw.powerball).toBeLessThanOrEqual(rules.powerball.pool);
        } else {
          expect(draw.powerball).toBeNull();
        }
      }
    }
  });

  it('draws six ordered 0–9 digits for Super 66 and has no draws for raffle games', () => {
    const s66 = generateSampleSnapshot(BUILTIN_RULES['super-66'], { now: NOW });
    expect(s66.draws.length).toBeGreaterThan(0);
    for (const draw of s66.draws) {
      expect(draw.main).toHaveLength(6);
      expect(draw.main.every((d) => Number.isInteger(d) && d >= 0 && d <= 9)).toBe(true);
    }
    expect(generateSampleSnapshot(BUILTIN_RULES['lucky-lotteries-super'], { now: NOW }).draws).toEqual([]);
  });
});
