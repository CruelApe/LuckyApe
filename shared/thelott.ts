import { SUPER_66_DIGITS } from './games';
import type { Draw, GameRules, GameSlug } from './types';
import { UpstreamError, type HttpClient } from './upstream';

/**
 * The Lott's public data API, as called by the site's own front-end scripts
 * (`sales/vmax/web/data/lotto/...`). Request shapes were read from those scripts and the
 * 50-draw / 90-day search limits are enforced by the API itself; we stay inside them.
 *
 * Shared by the scraper service and the app, which can fetch from The Lott directly.
 */
export const DEFAULT_THELOTT_API_BASE = 'https://data.api.thelott.com';
/** The Lott company filter; results are national, this only selects the dividend jurisdiction. */
export const DEFAULT_THELOTT_COMPANY = 'Tattersalls';

export interface TheLottApiConfig {
  thelottApiBase: string;
  thelottCompany: string;
}

export const PRODUCT_IDS: Record<GameSlug, string> = {
  tattslotto: 'TattsLotto',
  'weekday-windfall': 'MondayWednesdayFridayLotto',
  'oz-lotto': 'OzLotto',
  powerball: 'Powerball',
  'lucky-lotteries-super': 'LuckyLotteries2',
  'lucky-lotteries-mega': 'LuckyLotteries5',
  'super-66': 'Super66',
};

/** `latestresults` returns at most this many draws per product. */
export const LATEST_MAX_PER_PRODUCT = 10;
/** `drawrange` rejects spans wider than 50 draw numbers. */
export const DRAW_RANGE_SPAN = 50;
/** Safety cap on history windows per game per refresh. */
const MAX_HISTORY_WINDOWS = 8;
const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface RawDraw {
  ProductId?: string;
  DrawNumber?: number;
  DrawDate?: string;
  PrimaryNumbers?: number[] | null;
  SecondaryNumbers?: number[] | null;
}

interface ApiEnvelope {
  Success?: boolean;
  ErrorInfo?: { DisplayMessage?: string } | null;
}

interface LatestResultsResponse extends ApiEnvelope {
  DrawResults?: RawDraw[] | null;
}

interface SearchResponse extends ApiEnvelope {
  Draws?: RawDraw[] | null;
}

export interface RawOpenDraw {
  ProductId?: string;
  DrawDate?: string;
  Div1Amount?: number;
  IsDiv1Unknown?: boolean;
  DaysOfWeek?: string | string[] | null;
}

interface OpenDrawsResponse extends ApiEnvelope {
  Draws?: RawOpenDraw[] | null;
}

export interface OpenDrawInfo {
  /** AUD, or null when The Lott does not publish a figure yet. */
  jackpot: number | null;
  /** Weekdays the game is drawn, Monday first. */
  drawDays: string[];
}

function assertSuccess(response: ApiEnvelope, url: string): void {
  if (response.Success === false) {
    const reason = response.ErrorInfo?.DisplayMessage ?? 'no reason given';
    throw new UpstreamError(`The Lott API reported failure: ${reason}`, url);
  }
}

const isoDate = (raw: string | undefined): string | null => {
  const match = raw?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
};

const isIntInRange = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

/**
 * Convert a raw API draw to our model, or null if it does not look like a valid draw for
 * these rules. Strict on purpose: a quietly wrong draw would skew every statistic.
 */
export function normalizeDraw(rules: GameRules, raw: RawDraw): Draw | null {
  const date = isoDate(raw.DrawDate);
  const primary = raw.PrimaryNumbers;
  const secondary = raw.SecondaryNumbers ?? [];
  if (!date || !Array.isArray(primary)) return null;
  const drawNumber = Number.isInteger(raw.DrawNumber) ? (raw.DrawNumber as number) : null;

  if (rules.slug === 'super-66') {
    if (primary.length !== SUPER_66_DIGITS || !primary.every((d) => isIntInRange(d, 0, 9))) return null;
    return { drawNumber, date, main: [...primary], supplementary: [], powerball: null };
  }
  if (rules.kind !== 'pick' || !rules.main) return null;

  const { pick, pool } = rules.main;
  if (primary.length !== pick || !primary.every((n) => isIntInRange(n, 1, pool))) return null;
  if (new Set(primary).size !== pick) return null;
  const main = [...primary].sort((a, b) => a - b);

  if (rules.powerball) {
    const powerball = secondary[0];
    if (secondary.length !== 1 || !isIntInRange(powerball, 1, rules.powerball.pool)) return null;
    return { drawNumber, date, main, supplementary: [], powerball };
  }

  if (secondary.length !== rules.supplementaries || !secondary.every((n) => isIntInRange(n, 1, pool))) {
    return null;
  }
  return { drawNumber, date, main, supplementary: [...secondary].sort((a, b) => a - b), powerball: null };
}

/** Normalise a batch; refuse the whole batch if most of it is rejected (the API shape changed). */
export function normalizeDraws(rules: GameRules, rawDraws: RawDraw[], url: string): Draw[] {
  const draws = rawDraws.map((raw) => normalizeDraw(rules, raw));
  const valid = draws.filter((d): d is Draw => d !== null);
  if (rawDraws.length > 0 && valid.length < rawDraws.length / 2) {
    throw new UpstreamError(
      `Only ${valid.length} of ${rawDraws.length} ${rules.name} draws matched the expected format`,
      url,
    );
  }
  return valid;
}

const byNewest = (a: Draw, b: Draw) =>
  b.date.localeCompare(a.date) || (b.drawNumber ?? 0) - (a.drawNumber ?? 0);

/** Merge draw lists, de-duplicate by draw number (or date), newest first. */
export function mergeDraws(...lists: Draw[][]): Draw[] {
  const seen = new Map<string, Draw>();
  for (const draw of lists.flat()) {
    seen.set(draw.drawNumber !== null ? `n${draw.drawNumber}` : `d${draw.date}`, draw);
  }
  return [...seen.values()].sort(byNewest);
}

export class TheLottApi {
  constructor(
    private readonly http: HttpClient,
    private readonly config: TheLottApiConfig,
  ) {}

  private url(endpoint: string): string {
    return `${this.config.thelottApiBase}/sales/vmax/web/data/lotto/${endpoint}`;
  }

  /** Most recent draws (max 10) for one product. */
  async fetchLatest(rules: GameRules, count = LATEST_MAX_PER_PRODUCT): Promise<Draw[]> {
    const url = this.url('latestresults');
    const response = await this.http.postJson<LatestResultsResponse>(url, {
      CompanyId: this.config.thelottCompany,
      OptionalProductFilter: [PRODUCT_IDS[rules.slug]],
      MaxDrawCountPerProduct: Math.min(count, LATEST_MAX_PER_PRODUCT),
    });
    assertSuccess(response, url);
    const mine = (response.DrawResults ?? []).filter((d) => d.ProductId === PRODUCT_IDS[rules.slug]);
    return normalizeDraws(rules, mine, url);
  }

  /** Date of the latest draw for a game whose numbers we do not model (raffle games). */
  async fetchLastDrawDate(rules: GameRules): Promise<string | null> {
    const url = this.url('latestresults');
    const response = await this.http.postJson<LatestResultsResponse>(url, {
      CompanyId: this.config.thelottCompany,
      OptionalProductFilter: [PRODUCT_IDS[rules.slug]],
      MaxDrawCountPerProduct: 1,
    });
    assertSuccess(response, url);
    const dates = (response.DrawResults ?? [])
      .filter((d) => d.ProductId === PRODUCT_IDS[rules.slug])
      .map((d) => isoDate(d.DrawDate))
      .filter((d): d is string => d !== null)
      .sort();
    return dates.at(-1) ?? null;
  }

  /** Draws with numbers in [min, max]; the API rejects spans over 50. */
  async fetchDrawRange(rules: GameRules, min: number, max: number): Promise<Draw[]> {
    if (max - min + 1 > DRAW_RANGE_SPAN) {
      throw new RangeError(`Draw range ${min}-${max} is wider than ${DRAW_RANGE_SPAN}`);
    }
    const url = this.url('results/search/drawrange');
    const response = await this.http.postJson<SearchResponse>(url, {
      MinDrawNo: min,
      MaxDrawNo: max,
      Product: PRODUCT_IDS[rules.slug],
      CompanyFilter: [this.config.thelottCompany],
    });
    assertSuccess(response, url);
    return normalizeDraws(rules, response.Draws ?? [], url);
  }

  /**
   * Latest draws plus as much older history as needed to reach `target`, fetched in
   * 50-draw-number windows. `known` (a previous snapshot) lets repeat refreshes stop as soon
   * as the new draws join up with what we already have.
   */
  async fetchHistory(rules: GameRules, target: number, known: Draw[] = []): Promise<Draw[]> {
    const latest = await this.fetchLatest(rules);
    const knownNumbers = new Set(known.map((d) => d.drawNumber).filter((n): n is number => n !== null));
    let merged = mergeDraws(latest, known);
    const joinsKnown = (draws: Draw[]) => draws.some((d) => d.drawNumber !== null && knownNumbers.has(d.drawNumber));
    if (joinsKnown(latest) && known.length >= target - latest.length) return merged.slice(0, target);

    const numbers = latest.map((d) => d.drawNumber).filter((n): n is number => n !== null);
    let floor = numbers.length > 0 ? Math.min(...numbers) : 0;
    let emptyWindows = 0;

    for (let window = 0; window < MAX_HISTORY_WINDOWS && merged.length < target && floor > 1; window++) {
      const max = floor - 1;
      const min = Math.max(1, max - (DRAW_RANGE_SPAN - 1));
      const batch = await this.fetchDrawRange(rules, min, max);
      merged = mergeDraws(merged, batch);
      floor = min;
      emptyWindows = batch.length === 0 ? emptyWindows + 1 : 0;
      if (emptyWindows >= 2) break;
    }
    return merged.slice(0, target);
  }

  /** Current jackpot and draw days for each requested game, from the open (upcoming) draws. */
  async fetchOpenDraws(slugs: GameSlug[]): Promise<Map<GameSlug, OpenDrawInfo>> {
    const url = this.url('opendraws');
    const response = await this.http.postJson<OpenDrawsResponse>(url, {
      CompanyId: this.config.thelottCompany,
      MaxDrawCount: 20,
      OptionalProductFilter: slugs.map((slug) => PRODUCT_IDS[slug]),
    });
    assertSuccess(response, url);

    const result = new Map<GameSlug, OpenDrawInfo>();
    for (const slug of slugs) {
      const open = (response.Draws ?? [])
        .filter((d) => d.ProductId === PRODUCT_IDS[slug] && isoDate(d.DrawDate))
        .sort((a, b) => (isoDate(a.DrawDate) as string).localeCompare(isoDate(b.DrawDate) as string));
      if (open.length === 0) continue;

      const next = open[0];
      const known = typeof next.Div1Amount === 'number' && next.IsDiv1Unknown !== true && next.Div1Amount > 1;
      const days = new Set(
        open.flatMap((d) => (Array.isArray(d.DaysOfWeek) ? d.DaysOfWeek : [d.DaysOfWeek ?? ''])),
      );
      result.set(slug, {
        jackpot: known ? (next.Div1Amount as number) : null,
        drawDays: WEEKDAY_ORDER.filter((day) => days.has(day)),
      });
    }
    return result;
  }
}
