import { formatJackpot } from '@shared/format';
import { BUILTIN_RULES } from '@shared/games';
import type { OpenDrawInfo } from '@shared/thelott';
import { GAME_SLUGS, type GameSlug } from '@shared/types';

import type { LoadedGame } from './gameData';

/**
 * The alert amount is set in whole millions of AUD. Zero means "any jackpot": every game alerts as soon
 * as it has a jackpot, and again each time one is won and starts over (see `evaluateJackpotAlerts`).
 */
export const MIN_THRESHOLD_MILLIONS = 0;
export const MAX_THRESHOLD_MILLIONS = 200;
export const DEFAULT_THRESHOLD_MILLIONS = 50;
export const THRESHOLD_STEP_MILLIONS = 5;
export const THRESHOLD_PRESETS_MILLIONS = [0, 10, 20, 30, 50, 100] as const;

/** Keeps a hand-edited or corrupt value usable: whole millions inside the allowed range. */
export function clampThreshold(millions: number): number {
  if (!Number.isFinite(millions)) return DEFAULT_THRESHOLD_MILLIONS;
  return Math.min(MAX_THRESHOLD_MILLIONS, Math.max(MIN_THRESHOLD_MILLIONS, Math.round(millions)));
}

/** The amount as shown on a control: "Any", "$5M", "$50M". */
export const formatThreshold = (millions: number): string => (millions === 0 ? 'Any' : formatJackpot(millions * 1_000_000));

/** The amount in a sentence: "any jackpot", "$50M or more". */
export const describeThreshold = (millions: number): string =>
  millions === 0 ? 'any jackpot' : `${formatThreshold(millions)} or more`;

/**
 * The jackpot last seen for each game that is at or above the alert amount, i.e. the games already
 * alerted on. A game missing from here is "armed": its next reading at or above the amount alerts.
 */
export type AlertedJackpots = Partial<Record<GameSlug, number>>;

/** A jackpot as read from The Lott. `null` means it was not published (or not read). */
export interface JackpotReading {
  slug: GameSlug;
  jackpot: number | null;
}

export interface JackpotAlert {
  slug: GameSlug;
  jackpot: number;
}

/**
 * Readings worth alerting on from loaded games. Only live data counts: sample data is generated, and a
 * cached jackpot is old news that was already acted on (or not) when it was live.
 */
export function readingsFromGames(games: readonly LoadedGame[]): JackpotReading[] {
  return games
    .filter((game) => game.origin === 'live' && game.snapshot.source !== 'sample')
    .map((game) => ({ slug: game.snapshot.slug, jackpot: game.snapshot.jackpot }));
}

/** Readings from The Lott's open draws (one request covers every game). */
export function readingsFromOpenDraws(openDraws: ReadonlyMap<GameSlug, OpenDrawInfo>): JackpotReading[] {
  return [...openDraws].map(([slug, info]) => ({ slug, jackpot: info.jackpot }));
}

/**
 * Which games to alert on, and the new alerted-state. Pure.
 *  - A jackpot at or above the amount alerts once, when it first gets there.
 *  - It re-arms when the jackpot drops below the amount, or goes down at all (a win resets it, and the
 *    new jackpot may still be above a low amount: that is a new run, worth another alert).
 *  - An unknown jackpot says nothing about whether it fell, so it changes nothing.
 */
export function evaluateJackpotAlerts(
  readings: readonly JackpotReading[],
  thresholdMillions: number,
  alerted: AlertedJackpots,
): { alerts: JackpotAlert[]; alerted: AlertedJackpots } {
  const threshold = thresholdMillions * 1_000_000;
  const next: AlertedJackpots = { ...alerted };
  const alerts: JackpotAlert[] = [];

  for (const { slug, jackpot } of readings) {
    if (jackpot === null || !Number.isFinite(jackpot)) continue;
    if (jackpot < threshold) {
      delete next[slug];
      continue;
    }
    const last = next[slug];
    if (last === undefined || jackpot < last) alerts.push({ slug, jackpot });
    next[slug] = jackpot;
  }
  return { alerts, alerted: next };
}

export function jackpotAlertMessage(alert: JackpotAlert, thresholdMillions: number): { title: string; body: string } {
  return {
    title: `${BUILTIN_RULES[alert.slug].name} jackpot: ${formatJackpot(alert.jackpot)}`,
    body:
      thresholdMillions === 0
        ? 'You chose to be alerted about any jackpot.'
        : `It is at or above your ${formatThreshold(thresholdMillions)} minimum.`,
  };
}

/** What goes into the notification so that tapping it can open the game. */
export const alertNotificationData = (alert: JackpotAlert): { slug: GameSlug } => ({ slug: alert.slug });

/** The game a tapped notification is about, or null if its data is missing or not one of our games. */
export function gameSlugFromNotificationData(data: unknown): GameSlug | null {
  const slug = typeof data === 'object' && data !== null ? (data as { slug?: unknown }).slug : undefined;
  return GAME_SLUGS.find((known) => known === slug) ?? null;
}

export interface AlertSettings {
  enabled: boolean;
  thresholdMillions: number;
  alerted: AlertedJackpots;
}

export interface AlertRunDeps {
  getSettings(): AlertSettings;
  saveAlerted(alerted: AlertedJackpots): void;
  /** Show the notification. Must reject if it could not be shown (e.g. permission was taken away). */
  notify(alert: JackpotAlert, thresholdMillions: number): Promise<void>;
  warn(message: string, error?: unknown): void;
}

/**
 * Check readings against the user's settings and notify for each jackpot that has just reached the amount.
 * Returns the alerts that were actually sent. Does nothing while alerts are off.
 *
 * The alerted-state is saved before the first await so two checks running at once (a screen loading
 * several games) cannot both alert on the same jackpot. An alert that failed to send is un-remembered,
 * so the next check tries again instead of silently dropping it.
 */
export async function runJackpotAlerts(readings: readonly JackpotReading[], deps: AlertRunDeps): Promise<JackpotAlert[]> {
  const { enabled, thresholdMillions, alerted } = deps.getSettings();
  if (!enabled || readings.length === 0) return [];

  const evaluation = evaluateJackpotAlerts(readings, thresholdMillions, alerted);
  deps.saveAlerted(evaluation.alerted);

  const sent: JackpotAlert[] = [];
  for (const alert of evaluation.alerts) {
    try {
      await deps.notify(alert, thresholdMillions);
      sent.push(alert);
    } catch (error) {
      deps.warn(`Could not send the ${alert.slug} jackpot alert`, error);
      const current = { ...deps.getSettings().alerted };
      const before = alerted[alert.slug];
      if (before === undefined) delete current[alert.slug];
      else current[alert.slug] = before;
      deps.saveAlerted(current);
    }
  }
  return sent;
}
