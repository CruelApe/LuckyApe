import { BUILTIN_RULES } from '@shared/games';
import { mulberry32 } from '@shared/rng';
import { generateSampleSnapshot } from '@shared/sample';
import { describe, expect, it } from 'vitest';

import { analyzeGame } from './analysis';
import { parityBand } from './balanced';
import { generateTickets, systemGameCount } from './generate';
import { isPickGame, type GeneratorMode, type PickGameRules } from './types';

const NOW = new Date('2026-10-18T09:00:00Z');

function setup(slug: 'tattslotto' | 'oz-lotto' | 'powerball' | 'weekday-windfall') {
  const rules = BUILTIN_RULES[slug] as PickGameRules;
  const snapshot = generateSampleSnapshot(rules, { now: NOW });
  const analysis = analyzeGame(rules, snapshot.draws);
  return { rules, analysis, dataSource: snapshot.source };
}

const make = (
  slug: Parameters<typeof setup>[0],
  mode: GeneratorMode,
  count: number,
  extra: Partial<Parameters<typeof generateTickets>[0]> = {},
  seed = 7,
) =>
  generateTickets({
    ...setup(slug),
    mode,
    count,
    rng: mulberry32(seed),
    now: () => NOW,
    ...extra,
  });

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('isPickGame', () => {
  it('is true only for games where the player chooses numbers', () => {
    expect(isPickGame(BUILTIN_RULES.powerball)).toBe(true);
    expect(isPickGame(BUILTIN_RULES['super-66'])).toBe(false);
    expect(isPickGame(BUILTIN_RULES['lucky-lotteries-mega'])).toBe(false);
  });
});

describe.each(['hot', 'cold', 'balanced', 'bounce'] as const)('%s strategy', (mode) => {
  it('returns sorted, distinct numbers inside the pool', () => {
    const { rules } = setup('oz-lotto');
    for (const t of make('oz-lotto', mode, 50)) {
      expect(t.numbers).toHaveLength(rules.main.pick);
      expect(new Set(t.numbers).size).toBe(t.numbers.length);
      expect([...t.numbers].sort((a, b) => a - b)).toEqual(t.numbers);
      expect(t.numbers.every((n) => n >= 1 && n <= rules.main.pool)).toBe(true);
      expect(t.mode).toBe(mode);
      expect(t.system).toBeNull();
      expect(t.powerball).toBeNull();
      expect(t.dataSource).toBe('sample');
    }
  });

  it('is reproducible with the same seed and differs with another', () => {
    const strip = (ts: ReturnType<typeof make>) => ts.map((t) => [t.id, t.numbers]);
    expect(strip(make('tattslotto', mode, 5, {}, 99))).toEqual(strip(make('tattslotto', mode, 5, {}, 99)));
    expect(strip(make('tattslotto', mode, 5, {}, 99))).not.toEqual(strip(make('tattslotto', mode, 5, {}, 100)));
  });

  it('produces distinct tickets within a batch', () => {
    const keys = make('tattslotto', mode, 40).map((t) => t.numbers.join('-'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('hot strategy', () => {
  it('favours numbers with a higher recency score than the pool average', () => {
    const { analysis } = setup('tattslotto');
    const recency = (n: number) => analysis.main.stats[n - 1].recency;
    const picked = make('tattslotto', 'hot', 300).flatMap((t) => t.numbers.map(recency));
    expect(mean(picked)).toBeGreaterThan(mean(analysis.main.stats.map((s) => s.recency)));
  });
});

describe('cold strategy', () => {
  it('favours numbers that are more overdue than the pool average', () => {
    const { analysis } = setup('tattslotto');
    const overdue = (n: number) => analysis.main.stats[n - 1].overdueRatio;
    const picked = make('tattslotto', 'cold', 300).flatMap((t) => t.numbers.map(overdue));
    expect(mean(picked)).toBeGreaterThan(mean(analysis.main.stats.map((s) => s.overdueRatio)));
  });

  it('picks less recent numbers than the hot strategy', () => {
    const { analysis } = setup('tattslotto');
    const recency = (n: number) => analysis.main.stats[n - 1].recency;
    const avg = (mode: GeneratorMode) =>
      mean(make('tattslotto', mode, 300).flatMap((t) => t.numbers.map(recency)));
    expect(avg('cold')).toBeLessThan(avg('hot'));
  });
});

describe('balanced strategy', () => {
  it.each(['tattslotto', 'oz-lotto', 'powerball'] as const)(
    'respects the parity band, the historical sum band and the run limit (%s)',
    (slug) => {
      const { rules, analysis } = setup(slug);
      const band = parityBand(rules.main.pick);
      for (const t of make(slug, 'balanced', 100)) {
        const odd = t.numbers.filter((n) => n % 2 === 1).length;
        expect(odd).toBeGreaterThanOrEqual(band.oddMin);
        expect(odd).toBeLessThanOrEqual(band.oddMax);
        if (!t.badges.some((b) => b.id === 'relaxed')) {
          const sum = t.numbers.reduce((a, b) => a + b, 0);
          expect(sum).toBeGreaterThanOrEqual(analysis.sum.low);
          expect(sum).toBeLessThanOrEqual(analysis.sum.high);
          const runs = t.numbers.reduce(
            (acc, n, i) => (i > 0 && n === t.numbers[i - 1] + 1 ? [...acc.slice(0, -1), acc.at(-1)! + 1] : [...acc, 1]),
            [] as number[],
          );
          expect(Math.max(...runs)).toBeLessThanOrEqual(2);
        }
      }
    },
  );

  it('allows 3:3, 4:2 and 2:4 for a six-number game', () => {
    expect(parityBand(6)).toEqual({ oddMin: 2, oddMax: 4 });
    expect(parityBand(7)).toEqual({ oddMin: 3, oddMax: 4 });
  });
});

describe('supplementary bounce strategy', () => {
  it('carries recent supplementary numbers into the main set', () => {
    const { analysis } = setup('tattslotto');
    const needed = Math.min(2, analysis.carryCandidates.length);
    expect(needed).toBeGreaterThan(0);
    for (const t of make('tattslotto', 'bounce', 60)) {
      const carried = t.numbers.filter((n) => analysis.carryCandidates.includes(n)).length;
      expect(carried).toBeGreaterThanOrEqual(needed);
      expect(t.badges.some((b) => b.id === 'carry')).toBe(true);
    }
  });

  it('still produces a valid ticket when there are no carry-over candidates', () => {
    const { rules } = setup('tattslotto');
    const empty = analyzeGame(rules, []);
    const [ticket] = generateTickets({
      rules,
      analysis: empty,
      mode: 'bounce',
      dataSource: 'sample',
      rng: mulberry32(1),
    });
    expect(ticket.numbers).toHaveLength(6);
  });
});

describe('Powerball number', () => {
  it.each(['hot', 'cold', 'balanced', 'bounce'] as const)('is chosen in 1..20 for %s', (mode) => {
    for (const t of make('powerball', mode, 40)) {
      expect(t.powerball).toBeGreaterThanOrEqual(1);
      expect(t.powerball).toBeLessThanOrEqual(20);
    }
  });
});

describe('System entries', () => {
  const system = (size: number, powerHit = false) => ({
    system: { size, basedOn: 'hot' as const, powerHit },
  });

  it('covers C(size, pick) standard games', () => {
    const [oz] = make('oz-lotto', 'system', 1, system(8));
    expect(oz.numbers).toHaveLength(8);
    expect(oz.system).toEqual({ size: 8, games: 8, powerHit: false });

    const [tatts] = make('tattslotto', 'system', 1, system(20));
    expect(tatts.system!.games).toBe(38_760);
    expect(tatts.badges[0].label).toBe('38,760 games');

    const { rules } = setup('tattslotto');
    expect(systemGameCount(rules, 7)).toBe(7);
  });

  it('accepts the full official range and rejects anything outside it', () => {
    for (let size = 7; size <= 20; size++) {
      expect(make('tattslotto', 'system', 1, system(size))[0].numbers).toHaveLength(size);
    }
    expect(() => make('tattslotto', 'system', 1, system(6))).toThrow(RangeError);
    expect(() => make('tattslotto', 'system', 1, system(21))).toThrow(RangeError);
    expect(() => make('oz-lotto', 'system', 1, system(7))).toThrow(/8–20/);
    expect(() => make('tattslotto', 'system', 1, system(8.5))).toThrow(RangeError);
  });

  it('requires a system request', () => {
    expect(() => make('tattslotto', 'system', 1)).toThrow(/size/);
  });

  it('supports every base strategy', () => {
    for (const basedOn of ['hot', 'cold', 'balanced', 'bounce'] as const) {
      const [t] = make('weekday-windfall', 'system', 1, { system: { size: 10, basedOn, powerHit: false } });
      expect(new Set(t.numbers).size).toBe(10);
      expect(t.basedOn).toBe(basedOn);
    }
  });

  it('Powerball: standard systems pick a Powerball, PowerHit guarantees it instead', () => {
    const [standard] = make('powerball', 'system', 1, system(9));
    expect(standard.powerball).not.toBeNull();
    const [powerHit] = make('powerball', 'system', 1, system(15, true));
    expect(powerHit.powerball).toBeNull();
    expect(powerHit.system).toMatchObject({ size: 15, powerHit: true });
    expect(() => make('powerball', 'system', 1, system(16, true))).toThrow(RangeError);
    expect(() => make('powerball', 'system', 1, system(7))).toThrow(RangeError);
  });

  it('has no PowerHit option on other games', () => {
    expect(() => make('tattslotto', 'system', 1, system(10, true))).toThrow(/no PowerHit/);
  });
});

describe('badges', () => {
  it('describe facts about the numbers, in a stable order', () => {
    const [t] = make('tattslotto', 'hot', 1);
    const ids = t.badges.map((b) => b.id);
    expect(ids).toContain('parity');
    expect(ids).toContain('sum');
    expect(ids).toContain('spread');
    const parity = t.badges.find((b) => b.id === 'parity')!;
    const odd = t.numbers.filter((n) => n % 2 === 1).length;
    expect(parity.label).toBe(`${odd} odd · ${6 - odd} even`);
    const sum = t.badges.find((b) => b.id === 'sum')!;
    expect(sum.label).toBe(`Sum ${t.numbers.reduce((a, b) => a + b, 0)}`);
  });
});
