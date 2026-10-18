import { combinations } from '../../../shared/math';
import type { GameRules, SystemRange } from '../../../shared/types';
import type { ParsedRules } from './parseHowToPlay';

export interface MergeResult {
  rules: GameRules;
  /** `scraped` once the page confirmed the core pick/pool rules. */
  source: 'builtin' | 'scraped';
  /** Human-readable differences from the built-in rules (empty when the site agrees). */
  changes: string[];
}

const isCount = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

const sameRange = (a: SystemRange | null, b: SystemRange | null) =>
  a === b || (a !== null && b !== null && a.min === b.min && a.max === b.max);

const fmt = (r: SystemRange | null) => (r ? `${r.min}–${r.max}` : 'none');

function validRange(range: SystemRange | undefined, minAllowed: number): range is SystemRange {
  return !!range && isCount(range.min, minAllowed, 50) && isCount(range.max, range.min, 50);
}

/**
 * Overlay facts parsed from the how-to-play page onto the built-in rules. Anything that fails
 * validation is ignored (the built-in value stays), so a layout change on the site can degrade
 * the data but never corrupt the generator.
 */
export function mergeRules(
  builtin: GameRules,
  parsed: ParsedRules,
  liveDrawDays: string[] = [],
): MergeResult {
  const rules: GameRules = { ...builtin };
  const changes: string[] = [];
  let confirmed = false;

  if (builtin.kind === 'pick') {
    if (isCount(parsed.pick, 2, 20) && isCount(parsed.pool, parsed.pick + 1, 90)) {
      confirmed = true;
      const before = builtin.main!;
      if (before.pick !== parsed.pick || before.pool !== parsed.pool) {
        changes.push(`main numbers: ${before.pick} of ${before.pool} -> ${parsed.pick} of ${parsed.pool}`);
        rules.main = { pick: parsed.pick, pool: parsed.pool };
      }
    }

    if (isCount(parsed.powerballPool, 2, 99) && parsed.powerballPool !== builtin.powerball?.pool) {
      changes.push(`powerball barrel: ${builtin.powerball?.pool ?? 'none'} -> ${parsed.powerballPool}`);
      rules.powerball = { pool: parsed.powerballPool };
    }

    const pick = rules.main!.pick;
    if (validRange(parsed.system, pick) && !sameRange(parsed.system, builtin.system)) {
      changes.push(`system entries: ${fmt(builtin.system)} -> ${fmt(parsed.system)}`);
      rules.system = parsed.system;
    }
    if (validRange(parsed.powerHitSystem, pick) && !sameRange(parsed.powerHitSystem, builtin.powerHitSystem)) {
      changes.push(`PowerHit system: ${fmt(builtin.powerHitSystem)} -> ${fmt(parsed.powerHitSystem)}`);
      rules.powerHitSystem = parsed.powerHitSystem;
    }

    if (parsed.divisions.length > 0) {
      const { pick: p, pool } = rules.main!;
      const expectedDiv1 = combinations(pool, p) * (rules.powerball?.pool ?? 1);
      const countAgrees =
        parsed.declaredDivisions === undefined || parsed.declaredDivisions === parsed.divisions.length;
      if (!countAgrees) {
        changes.push(
          `divisions ignored: page says ${parsed.declaredDivisions} but ${parsed.divisions.length} were parsed`,
        );
      } else if (parsed.divisions[0].oddsOneIn !== expectedDiv1) {
        changes.push(
          `divisions ignored: Division 1 odds ${parsed.divisions[0].oddsOneIn} do not match ${expectedDiv1} for these rules`,
        );
      } else {
        rules.divisions = parsed.divisions;
      }
    }
  }

  if (liveDrawDays.length > 0 && liveDrawDays.join() !== builtin.drawDays.join()) {
    changes.push(`draw days: ${builtin.drawDays.join('/') || 'none'} -> ${liveDrawDays.join('/')}`);
    rules.drawDays = liveDrawDays;
  }

  return { rules, source: confirmed ? 'scraped' : 'builtin', changes };
}
