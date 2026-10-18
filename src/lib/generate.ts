import { combinations } from '@shared/math';
import type { Rng } from '@shared/rng';
import type { DataSource } from '@shared/types';

import { balanceLevels, satisfies } from './balanced';
import { buildBadges } from './badges';
import { sampleDistinct } from './sampling';
import type {
  GameAnalysis,
  GeneratedTicket,
  GeneratorMode,
  PickGameRules,
  Strategy,
} from './types';
import { coldWeights, flatWeights, hotWeights } from './weights';

const MAX_BALANCED_ATTEMPTS = 3000;
const MAX_CARRY_SLOTS = 2;

function mainWeights(strategy: Strategy, analysis: GameAnalysis): number[] {
  switch (strategy) {
    case 'hot':
      return hotWeights(analysis.main, 1.5);
    case 'cold':
      return coldWeights(analysis.main, 1.5);
    case 'balanced':
      // Only a gentle lean towards frequent numbers; the filters do the real work.
      return hotWeights(analysis.main, 0.5);
    case 'bounce':
      return hotWeights(analysis.main, 1);
  }
}

interface PickResult {
  numbers: number[];
  relaxed: boolean;
}

/** Choose `count` distinct main numbers with one strategy. */
export function pickMainNumbers(
  rules: PickGameRules,
  analysis: GameAnalysis,
  strategy: Strategy,
  count: number,
  rng: Rng,
): PickResult {
  const weights = mainWeights(strategy, analysis);

  if (strategy === 'balanced') {
    // The sum band is defined for `pick` numbers; scale it for larger System entries.
    const scale = count / rules.main.pick;
    const levels = balanceLevels(count, {
      ...analysis.sum,
      low: Math.round(analysis.sum.low * scale),
      high: Math.round(analysis.sum.high * scale),
    });
    for (const [index, level] of levels.entries()) {
      for (let attempt = 0; attempt < MAX_BALANCED_ATTEMPTS; attempt++) {
        const candidate = sampleDistinct(weights, count, rng);
        if (satisfies(candidate, level)) return { numbers: candidate, relaxed: index > 0 };
      }
    }
    return { numbers: sampleDistinct(weights, count, rng), relaxed: true };
  }

  if (strategy === 'bounce') {
    const candidates = new Set(analysis.carryCandidates);
    const slots = Math.min(MAX_CARRY_SLOTS, candidates.size, count - 1);
    const carryWeights = weights.map((w, i) => (candidates.has(i + 1) ? w : 0));
    const carried = slots > 0 ? sampleDistinct(carryWeights, slots, rng) : [];
    const rest = sampleDistinct(weights, count - carried.length, rng, new Set(carried));
    return { numbers: [...carried, ...rest].sort((a, b) => a - b), relaxed: false };
  }

  return { numbers: sampleDistinct(weights, count, rng), relaxed: false };
}

/** Choose the Powerball number (1..pool) for games that have one. */
export function pickPowerball(
  rules: PickGameRules,
  analysis: GameAnalysis,
  strategy: Strategy,
  rng: Rng,
): number | null {
  if (!rules.powerball || !analysis.powerball) return null;
  const pool = analysis.powerball;
  const weights =
    strategy === 'hot'
      ? hotWeights(pool, 1.5)
      : strategy === 'cold'
        ? coldWeights(pool, 1.5)
        : strategy === 'bounce'
          ? hotWeights(pool, 1)
          : flatWeights(rules.powerball.pool);
  return sampleDistinct(weights, 1, rng)[0];
}

export interface SystemRequest {
  size: number;
  basedOn: Strategy;
  /** Powerball only: guarantee the Powerball instead of choosing one. */
  powerHit: boolean;
}

export function systemRangeFor(rules: PickGameRules, powerHit: boolean) {
  return powerHit ? rules.powerHitSystem : rules.system;
}

/** How many standard games a System entry of `size` numbers covers. */
export function systemGameCount(rules: PickGameRules, size: number): number {
  return combinations(size, rules.main.pick);
}

export interface GenerateRequest {
  rules: PickGameRules;
  analysis: GameAnalysis;
  mode: GeneratorMode;
  /** Required when `mode` is `system`. */
  system?: SystemRequest;
  /** Number of distinct tickets to produce (default 1). */
  count?: number;
  dataSource: DataSource;
  rng?: Rng;
  now?: () => Date;
}

function newId(rules: PickGameRules, createdAt: string, rng: Rng): string {
  return `${rules.slug}-${Date.parse(createdAt).toString(36)}-${Math.floor(rng() * 36 ** 4).toString(36)}`;
}

function buildTicket(request: GenerateRequest, rng: Rng): GeneratedTicket {
  const { rules, analysis, mode, system, dataSource } = request;
  const createdAt = (request.now?.() ?? new Date()).toISOString();

  if (mode === 'system') {
    if (!system) throw new Error('A system entry needs a size and a base strategy');
    const range = systemRangeFor(rules, system.powerHit);
    if (!range) {
      throw new RangeError(`${rules.name} has no ${system.powerHit ? 'PowerHit ' : ''}System entries`);
    }
    if (!Number.isInteger(system.size) || system.size < range.min || system.size > range.max) {
      throw new RangeError(
        `System size must be ${range.min}–${range.max} for ${rules.name} (got ${system.size})`,
      );
    }
    const picked = pickMainNumbers(rules, analysis, system.basedOn, system.size, rng);
    const games = systemGameCount(rules, system.size);
    return {
      id: newId(rules, createdAt, rng),
      slug: rules.slug,
      mode,
      basedOn: system.basedOn,
      createdAt,
      numbers: picked.numbers,
      powerball: system.powerHit ? null : pickPowerball(rules, analysis, system.basedOn, rng),
      system: { size: system.size, games, powerHit: system.powerHit },
      badges: buildBadges(rules, analysis, picked.numbers, {
        mode,
        systemGames: games,
        relaxed: picked.relaxed,
      }),
      drawsAnalysed: analysis.drawCount,
      dataSource,
    };
  }

  const picked = pickMainNumbers(rules, analysis, mode, rules.main.pick, rng);
  return {
    id: newId(rules, createdAt, rng),
    slug: rules.slug,
    mode,
    basedOn: null,
    createdAt,
    numbers: picked.numbers,
    powerball: pickPowerball(rules, analysis, mode, rng),
    system: null,
    badges: buildBadges(rules, analysis, picked.numbers, { mode, relaxed: picked.relaxed }),
    drawsAnalysed: analysis.drawCount,
    dataSource,
  };
}

const ticketKey = (t: GeneratedTicket) => `${t.numbers.join('-')}|${t.powerball ?? ''}`;

/** Generate `count` distinct tickets. Re-rolls duplicates a bounded number of times. */
export function generateTickets(request: GenerateRequest): GeneratedTicket[] {
  const rng = request.rng ?? Math.random;
  const wanted = request.count ?? 1;
  const tickets: GeneratedTicket[] = [];
  const seen = new Set<string>();

  for (let attempts = 0; tickets.length < wanted && attempts < wanted * 25; attempts++) {
    const ticket = buildTicket(request, rng);
    const key = ticketKey(ticket);
    if (seen.has(key)) continue;
    seen.add(key);
    tickets.push(ticket);
  }
  return tickets;
}
