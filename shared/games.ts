import type { Division, GameRules, GameSlug } from './types';
import { GAME_SLUGS } from './types';

const BASE_URL = 'https://www.thelott.com';

const urls = (slug: string, howToPlaySlug = slug) => ({
  resultsUrl: `${BASE_URL}/${slug}/results`,
  howToPlayUrl: `${BASE_URL}/${howToPlaySlug}/how-to-play`,
});

const div = (division: number, match: string, oddsOneIn: number): Division => ({
  division,
  match,
  oddsOneIn,
});

const SIX_FROM_45_DIVISIONS = [
  div(1, '6 winning numbers', 8_145_060),
  div(2, '5 winning numbers + 1 supplementary', 678_755),
  div(3, '5 winning numbers', 36_690),
  div(4, '4 winning numbers', 733),
  div(5, '3 winning numbers + 1 supplementary', 298),
];

const RAFFLE_NOTE =
  'Lucky Lotteries is a raffle-style game: The Lott allocates your numbers, so there is nothing to choose and no statistical edge to model.';

/**
 * Built-in rules, verified against the how-to-play pages on 2026-10-18.
 * The scraper re-checks these at runtime and overrides anything that has changed.
 */
export const BUILTIN_RULES: Record<GameSlug, GameRules> = {
  tattslotto: {
    slug: 'tattslotto',
    name: 'TattsLotto',
    kind: 'pick',
    main: { pick: 6, pool: 45 },
    supplementaries: 2,
    powerball: null,
    system: { min: 7, max: 20 },
    powerHitSystem: null,
    drawDays: ['Saturday'],
    divisions: [...SIX_FROM_45_DIVISIONS, div(6, '3 winning numbers', 53)],
    allocatedNote: null,
    ...urls('tattslotto'),
  },
  'weekday-windfall': {
    slug: 'weekday-windfall',
    name: 'Weekday Windfall',
    kind: 'pick',
    main: { pick: 6, pool: 45 },
    supplementaries: 2,
    powerball: null,
    system: { min: 7, max: 20 },
    powerHitSystem: null,
    drawDays: ['Monday', 'Wednesday', 'Friday'],
    divisions: [...SIX_FROM_45_DIVISIONS, div(6, '1 winning number + 2 supplementaries', 144)],
    allocatedNote: null,
    ...urls('weekday-windfall'),
  },
  'oz-lotto': {
    slug: 'oz-lotto',
    name: 'Oz Lotto',
    kind: 'pick',
    main: { pick: 7, pool: 47 },
    supplementaries: 3,
    powerball: null,
    system: { min: 8, max: 20 },
    powerHitSystem: null,
    drawDays: ['Tuesday'],
    divisions: [
      div(1, '7 winning numbers', 62_891_499),
      div(2, '6 winning numbers + 1 supplementary', 2_994_834),
      div(3, '6 winning numbers', 242_825),
      div(4, '5 winning numbers + 1 supplementary', 26_271),
      div(5, '5 winning numbers', 4_497),
      div(6, '4 winning numbers', 182),
      div(7, '3 winning numbers + 1 supplementary', 71),
    ],
    allocatedNote: null,
    ...urls('oz-lotto'),
  },
  powerball: {
    slug: 'powerball',
    name: 'Powerball',
    kind: 'pick',
    main: { pick: 7, pool: 35 },
    supplementaries: 0,
    powerball: { pool: 20 },
    system: { min: 8, max: 20 },
    powerHitSystem: { min: 8, max: 15 },
    drawDays: ['Thursday'],
    divisions: [
      div(1, '7 winning numbers + the Powerball', 134_490_400),
      div(2, '7 winning numbers', 7_078_443),
      div(3, '6 winning numbers + the Powerball', 686_176),
      div(4, '6 winning numbers', 36_115),
      div(5, '5 winning numbers + the Powerball', 16_943),
      div(6, '4 winning numbers + the Powerball', 1_173),
      div(7, '5 winning numbers', 892),
      div(8, '3 winning numbers + the Powerball', 188),
      div(9, '2 winning numbers + the Powerball', 66),
    ],
    allocatedNote: null,
    ...urls('powerball'),
  },
  'lucky-lotteries-super': {
    slug: 'lucky-lotteries-super',
    name: 'Lucky Lotteries Super Jackpot',
    kind: 'allocated',
    main: null,
    supplementaries: 0,
    powerball: null,
    system: null,
    powerHitSystem: null,
    drawDays: [],
    divisions: [],
    allocatedNote: RAFFLE_NOTE,
    ...urls('lucky-lotteries-super', 'lucky-lotteries'),
  },
  'lucky-lotteries-mega': {
    slug: 'lucky-lotteries-mega',
    name: 'Lucky Lotteries Mega Jackpot',
    kind: 'allocated',
    main: null,
    supplementaries: 0,
    powerball: null,
    system: null,
    powerHitSystem: null,
    drawDays: [],
    divisions: [],
    allocatedNote: RAFFLE_NOTE,
    ...urls('lucky-lotteries-mega', 'lucky-lotteries'),
  },
  'super-66': {
    slug: 'super-66',
    name: 'Super 66',
    kind: 'allocated',
    main: null,
    supplementaries: 0,
    powerball: null,
    system: null,
    powerHitSystem: null,
    drawDays: ['Saturday'],
    divisions: [
      div(1, 'All 6 numbers in exact order', 1_000_000),
      div(2, 'First 5 or last 5 numbers in order', 55_556),
      div(3, 'First 4 or last 4 numbers in order', 5_556),
      div(4, 'First 3 or last 3 numbers in order', 556),
      div(5, 'First 2 or last 2 numbers in order', 56),
    ],
    allocatedNote:
      'Super 66 is QuickPick-only: six digits (0–9) are allocated for you and each position is an independent draw, so there is nothing to choose.',
    ...urls('super-66'),
  },
};

export const GAME_LIST: GameRules[] = GAME_SLUGS.map((slug) => BUILTIN_RULES[slug]);

export function isGameSlug(value: string): value is GameSlug {
  return (GAME_SLUGS as readonly string[]).includes(value);
}

/** Number of digits drawn for Super 66 (each position is 0–9). */
export const SUPER_66_DIGITS = 6;
