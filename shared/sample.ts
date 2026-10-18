import { SUPER_66_DIGITS } from './games';
import { hashString, mulberry32, type Rng } from './rng';
import type { Draw, GameRules, GameSnapshot } from './types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Draw ordinals count from here so a given date always maps to the same draw number. */
const EPOCH_UTC = Date.UTC(2020, 0, 1);
const DAY_MS = 86_400_000;

export interface SampleOptions {
  /** Reference "now"; the newest sample draw is the last scheduled day before it. */
  now?: Date;
  /** How many draws to generate (default 104, roughly 1–2 years). */
  draws?: number;
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Pick `count` distinct values from 1..pool in random order (partial Fisher–Yates). */
function shuffledPool(pool: number, count: number, rng: Rng): number[] {
  const numbers = Array.from({ length: pool }, (_, i) => i + 1);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (numbers.length - i));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers.slice(0, count);
}

function buildDraw(rules: GameRules, drawNumber: number, date: string): Draw {
  const rng = mulberry32(hashString(`${rules.slug}:${drawNumber}`));

  if (rules.slug === 'super-66') {
    // Six independent barrels of 0–9; order matters so the digits are not sorted.
    const main = Array.from({ length: SUPER_66_DIGITS }, () => Math.floor(rng() * 10));
    return { drawNumber, date, main, supplementary: [], powerball: null };
  }

  const { pick, pool } = rules.main!;
  const drawn = shuffledPool(pool, pick + rules.supplementaries, rng);
  const ascending = (a: number, b: number) => a - b;
  return {
    drawNumber,
    date,
    main: drawn.slice(0, pick).sort(ascending),
    supplementary: drawn.slice(pick).sort(ascending),
    powerball: rules.powerball ? 1 + Math.floor(rng() * rules.powerball.pool) : null,
  };
}

/**
 * Deterministic, clearly-labelled stand-in history. The numbers are genuinely random,
 * which is also what real lottery results look like to any statistical model.
 * Never used as if it were real data: `source` is always 'sample' and jackpot is null.
 */
export function generateSampleSnapshot(rules: GameRules, options: SampleOptions = {}): GameSnapshot {
  const now = options.now ?? new Date();
  const wanted = options.draws ?? 104;
  const drawWeekdays = new Set(rules.drawDays.map((d) => WEEKDAYS.indexOf(d)));

  const draws: Draw[] = [];
  if (drawWeekdays.size > 0) {
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const all: { drawNumber: number; ms: number }[] = [];
    let drawNumber = 0;
    for (let ms = EPOCH_UTC; ms < todayUtc; ms += DAY_MS) {
      if (drawWeekdays.has(new Date(ms).getUTCDay())) {
        drawNumber += 1;
        all.push({ drawNumber, ms });
      }
    }
    for (const { drawNumber: n, ms } of all.slice(-wanted).reverse()) {
      draws.push(buildDraw(rules, n, isoDate(ms)));
    }
  }

  return {
    slug: rules.slug,
    rules,
    rulesSource: 'builtin',
    source: 'sample',
    fetchedAt: now.toISOString(),
    draws,
    jackpot: null,
  };
}
