import { BUILTIN_RULES } from '@shared/games';
import { generateSampleSnapshot } from '@shared/sample';
import type { GameSnapshot } from '@shared/types';
import { describe, expect, it } from 'vitest';

import { describeOrigin } from '@/services/origin';

import { describeRules, howToPlaySteps, joinDays, ticketToText } from './text';
import type { GeneratedTicket } from './types';

describe('describeRules', () => {
  it.each([
    ['tattslotto', 'Pick 6 from 45'],
    ['oz-lotto', 'Pick 7 from 47'],
    ['powerball', 'Pick 7 from 35 + Powerball (1–20)'],
    ['super-66', '6 digits (0–9) · QuickPick only'],
    ['lucky-lotteries-mega', 'Raffle · numbers allocated'],
  ] as const)('%s -> %s', (slug, expected) => expect(describeRules(BUILTIN_RULES[slug])).toBe(expected));

  it('follows scraped rule changes', () => {
    expect(describeRules({ ...BUILTIN_RULES.tattslotto, main: { pick: 6, pool: 50 } })).toBe('Pick 6 from 50');
  });
});

describe('joinDays', () => {
  it('reads naturally', () => {
    expect(joinDays([])).toBe('');
    expect(joinDays(['Saturday'])).toBe('Saturday');
    expect(joinDays(['Tuesday', 'Thursday'])).toBe('Tuesday and Thursday');
    expect(joinDays(['Monday', 'Wednesday', 'Friday'])).toBe('Monday, Wednesday and Friday');
  });
});

describe('howToPlaySteps', () => {
  it('explains a standard game from its rules', () => {
    const steps = howToPlaySteps(BUILTIN_RULES.tattslotto);
    expect(steps[0]).toBe('Choose 6 numbers from 1 to 45.');
    expect(steps).toContain('2 supplementary numbers are drawn after the 6 main numbers; they count towards some lower divisions.');
    expect(steps).toContain('Drawn Saturday.');
    expect(steps.join(' ')).toContain('7 numbers is 7 games, 20 numbers is 38,760');
  });

  it('covers the Powerball barrel and PowerHit', () => {
    const steps = howToPlaySteps(BUILTIN_RULES.powerball).join('\n');
    expect(steps).toContain('7 numbers from 1 to 35, plus 1 Powerball number from 1 to 20');
    expect(steps).toContain('8 numbers is 8 games, 20 numbers is 77,520');
    expect(steps).toContain('PowerHit System lets you choose 8–15 main numbers');
  });

  it('uses the multi-day schedule for Weekday Windfall', () => {
    expect(howToPlaySteps(BUILTIN_RULES['weekday-windfall'])).toContain('Drawn Monday, Wednesday and Friday.');
  });

  it('follows scraped rule changes instead of hard-coded text', () => {
    const changed = { ...BUILTIN_RULES.tattslotto, system: { min: 7, max: 18 } };
    expect(howToPlaySteps(changed).join(' ')).toContain('7 numbers is 7 games, 18 numbers is 18,564');
  });

  it('explains allocated games without inventing a pick', () => {
    expect(howToPlaySteps(BUILTIN_RULES['lucky-lotteries-super'])).toEqual([BUILTIN_RULES['lucky-lotteries-super'].allocatedNote]);
    expect(howToPlaySteps(BUILTIN_RULES['super-66'])[0]).toMatch(/QuickPick only/);
  });
});

describe('ticketToText', () => {
  const base: GeneratedTicket = {
    id: 't',
    slug: 'powerball',
    mode: 'hot',
    basedOn: null,
    createdAt: '2026-10-18T00:00:00.000Z',
    numbers: [3, 14, 15, 24, 27, 30, 32],
    powerball: 16,
    system: null,
    badges: [],
    drawsAnalysed: 100,
    dataSource: 'thelott',
  };

  it('lists the numbers and the Powerball', () => {
    const text = ticketToText(base, 'Powerball');
    expect(text).toContain('Powerball — Standard entry');
    expect(text).toContain('3 14 15 24 27 30 32');
    expect(text).toContain('Powerball: 16');
    expect(text).toMatch(/not a prediction/);
  });

  it('describes System and PowerHit entries', () => {
    const text = ticketToText(
      { ...base, powerball: null, numbers: [1, 2, 3, 4, 5, 6, 7, 8], system: { size: 8, games: 8, powerHit: true } },
      'Powerball',
    );
    expect(text).toContain('System 8 entry');
    expect(text).toContain('PowerHit (Powerball guaranteed)');
    expect(text).toContain('Covers 8 standard games');
  });
});

describe('describeOrigin', () => {
  const NOW = new Date('2026-10-18T12:00:00Z');
  const snapshot = (overrides: Partial<GameSnapshot> = {}): GameSnapshot => ({
    ...generateSampleSnapshot(BUILTIN_RULES.tattslotto, { now: NOW, draws: 10 }),
    source: 'thelott',
    fetchedAt: '2026-10-18T09:00:00Z',
    ...overrides,
  });

  it('is a positive "live" message for fresh Lott data', () => {
    const info = describeOrigin({ snapshot: snapshot(), origin: 'live', error: null }, NOW);
    expect(info).toMatchObject({ tone: 'positive', title: 'Live from The Lott' });
    expect(info.detail).toMatch(/^10 draws · latest \w{3} \d+ \w{3} 2026$/);
  });

  it('warns when the server itself fell back to sample data', () => {
    const info = describeOrigin({ snapshot: snapshot({ source: 'sample' }), origin: 'live', error: null }, NOW);
    expect(info.tone).toBe('warning');
    expect(info.title).toBe('Sample data');
    expect(info.detail).toMatch(/not real results/);
  });

  it('says how old a cached copy is', () => {
    const info = describeOrigin({ snapshot: snapshot(), origin: 'cached', error: 'down' }, NOW);
    expect(info).toMatchObject({ tone: 'warning', title: 'Offline · saved 3 h ago' });
  });

  it('is explicit when the app has only generated data', () => {
    const info = describeOrigin({ snapshot: snapshot({ source: 'sample' }), origin: 'offline', error: 'down' }, NOW);
    expect(info.tone).toBe('warning');
    expect(info.detail).toMatch(/Start the scraper/);
  });

  it('uses lastDrawDate for games without draw history', () => {
    const raffle = snapshot({ draws: [], lastDrawDate: '2026-10-15' });
    const info = describeOrigin({ snapshot: raffle, origin: 'live', error: null }, NOW);
    expect(info.detail).toBe('Latest draw Thu 15 Oct 2026');
  });
});
