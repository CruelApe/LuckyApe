/**
 * Domain types shared by the mobile app (src/) and the scraper service (server/).
 * Keep this file dependency-free so both sides can import it.
 */

export const GAME_SLUGS = [
  'tattslotto',
  'weekday-windfall',
  'oz-lotto',
  'powerball',
  'lucky-lotteries-super',
  'lucky-lotteries-mega',
  'super-66',
] as const;

export type GameSlug = (typeof GAME_SLUGS)[number];

/**
 * `pick`      – the player chooses numbers from a pool (TattsLotto, Oz Lotto, ...).
 * `allocated` – numbers are issued by The Lott (raffle style / QuickPick only), so
 *               there is nothing for a statistical model to choose.
 */
export type GameKind = 'pick' | 'allocated';

/** Pick `pick` distinct numbers from 1..`pool`. */
export interface PickRange {
  pick: number;
  pool: number;
}

export interface SystemRange {
  min: number;
  max: number;
}

export interface Division {
  division: number;
  /** Short match description, e.g. "5 winning numbers + 1 supplementary". */
  match: string;
  /** Odds are "1 in `oddsOneIn`" for a single standard game. */
  oddsOneIn: number;
}

export interface GameRules {
  slug: GameSlug;
  name: string;
  kind: GameKind;
  /** Main number pool; null for allocated games. */
  main: PickRange | null;
  /** How many supplementary numbers are drawn after the main numbers. */
  supplementaries: number;
  /** Powerball-style bonus barrel (1..pool), if the game has one. */
  powerball: { pool: number } | null;
  /** Standard System entry sizes (numbers chosen from the main pool). */
  system: SystemRange | null;
  /** Powerball PowerHit System sizes (Powerball is guaranteed). */
  powerHitSystem: SystemRange | null;
  drawDays: string[];
  divisions: Division[];
  /** Explains, in plain language, why a game has no generator. */
  allocatedNote: string | null;
  resultsUrl: string;
  howToPlayUrl: string;
}

export interface Draw {
  drawNumber: number | null;
  /** ISO calendar date, YYYY-MM-DD. */
  date: string;
  /** Winning numbers as drawn, sorted ascending (Super 66: six digits in order). */
  main: number[];
  supplementary: number[];
  powerball: number | null;
}

/** Where the draw history came from. `sample` is generated data, never real results. */
export type DataSource = 'thelott' | 'import' | 'sample';

export interface GameSnapshot {
  slug: GameSlug;
  rules: GameRules;
  /** `scraped` when the rules were confirmed against the how-to-play page. */
  rulesSource: 'builtin' | 'scraped';
  source: DataSource;
  fetchedAt: string;
  /** Newest first. Empty for games whose results we do not model (raffle games). */
  draws: Draw[];
  /**
   * Date of the most recent draw (YYYY-MM-DD). Set even when `draws` is empty, so raffle games
   * can still show it. Older cached snapshots may lack it; fall back to `draws[0]?.date`.
   */
  lastDrawDate?: string | null;
  /** Current jackpot in AUD, or null when unknown. Never estimated. */
  jackpot: number | null;
}

export interface GamesResponse {
  generatedAt: string;
  games: GameSnapshot[];
}

export interface HealthResponse {
  ok: true;
  version: string;
  uptimeSeconds: number;
}
