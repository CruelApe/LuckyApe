import { BUILTIN_RULES } from '@shared/games';
import { DEFAULT_THELOTT_API_BASE, type OpenDrawInfo, type TheLottApi } from '@shared/thelott';
import type { GameRules, GameSlug, GameSnapshot } from '@shared/types';
import { UpstreamError } from '@shared/upstream';

/** Draws of history kept per pick-style game; The Lott serves them in windows of 50. */
export const HISTORY_DRAWS = 100;
/** A saved snapshot younger than this is reused without touching the network. */
export const SNAPSHOT_TTL_MS = 2 * 60 * 60_000;
const OPEN_DRAWS_TTL_MS = 10 * 60_000;
const OPEN_DRAWS_RETRY_MS = 2 * 60_000;
/** After a network failure, skip further attempts for this long so an offline start does not wait on every game. */
const OFFLINE_BACKOFF_MS = 30_000;

const RAFFLE_GAMES: readonly GameSlug[] = ['lucky-lotteries-super', 'lucky-lotteries-mega'];

export interface DirectSourceDeps {
  api: Pick<TheLottApi, 'fetchHistory' | 'fetchLastDrawDate' | 'fetchOpenDraws'>;
  /** The last good snapshot on this device; it is the base for cheap incremental refreshes. */
  readCache(slug: GameSlug): Promise<GameSnapshot | null>;
  now?: () => Date;
  historyDraws?: number;
  ttlMs?: number;
}

export interface DirectSource {
  /** Snapshot for one game, read straight from The Lott. Rejects if The Lott cannot be used. */
  fetchSnapshot(slug: GameSlug): Promise<GameSnapshot>;
}

/**
 * A failure before any HTTP response: no signal, DNS, timeout. The HTTP client records the underlying
 * error as `cause` only for these, so a changed API shape is not mistaken for being offline.
 * Refusals (401/403/429) are handled by the HTTP client itself.
 */
const isNetworkFailure = (error: unknown) =>
  error instanceof UpstreamError && error.status === undefined && error.cause !== undefined;

/**
 * Builds the same `GameSnapshot` the scraper service serves, but on the phone: no server needed.
 * The service's how-to-play page scraping is skipped, so rules are the built-in ones (with live draw days).
 *
 * Polite by construction: a recent saved snapshot costs no requests, a repeat refresh asks only for
 * the newest draws, and jackpots for every game come from a single shared request.
 */
export function createDirectSource(deps: DirectSourceDeps): DirectSource {
  const nowMs = () => (deps.now?.() ?? new Date()).getTime();
  const historyDraws = deps.historyDraws ?? HISTORY_DRAWS;
  const ttlMs = deps.ttlMs ?? SNAPSHOT_TTL_MS;

  const inflight = new Map<GameSlug, Promise<GameSnapshot>>();
  let openDraws: { at: number; data: Map<GameSlug, OpenDrawInfo> } | null = null;
  let openDrawsFailedAt = Number.NEGATIVE_INFINITY;
  let openDrawsInflight: Promise<Map<GameSlug, OpenDrawInfo> | null> | null = null;
  let offlineUntil = 0;

  const noteFailure = (error: unknown) => {
    if (isNetworkFailure(error)) offlineUntil = nowMs() + OFFLINE_BACKOFF_MS;
  };

  const isFresh = (snapshot: GameSnapshot) => {
    const age = nowMs() - Date.parse(snapshot.fetchedAt);
    return age >= 0 && age < ttlMs;
  };

  /** Jackpots and draw days for every game, fetched once and shared. A failure is not fatal: they are simply unknown. */
  function getOpenDraws(): Promise<Map<GameSlug, OpenDrawInfo> | null> {
    const t = nowMs();
    if (openDraws && t - openDraws.at < OPEN_DRAWS_TTL_MS) return Promise.resolve(openDraws.data);
    if (t - openDrawsFailedAt < OPEN_DRAWS_RETRY_MS) return Promise.resolve(openDraws?.data ?? null);
    openDrawsInflight ??= deps.api
      .fetchOpenDraws(Object.keys(BUILTIN_RULES) as GameSlug[])
      .then((data) => {
        openDraws = { at: nowMs(), data };
        return data;
      })
      .catch((error) => {
        noteFailure(error);
        openDrawsFailedAt = nowMs();
        return openDraws?.data ?? null;
      })
      .finally(() => {
        openDrawsInflight = null;
      });
    return openDrawsInflight;
  }

  async function refresh(slug: GameSlug, previous: GameSnapshot | null): Promise<GameSnapshot> {
    const open = await getOpenDraws();
    if (nowMs() < offlineUntil) throw new UpstreamError('No network connection', DEFAULT_THELOTT_API_BASE);

    const builtin = BUILTIN_RULES[slug];
    const liveDrawDays = open?.get(slug)?.drawDays ?? [];
    const rules: GameRules = liveDrawDays.length > 0 ? { ...builtin, drawDays: liveDrawDays } : builtin;

    let draws: GameSnapshot['draws'] = [];
    let lastDrawDate: string | null = null;
    if (RAFFLE_GAMES.includes(slug)) {
      // Raffle numbers are allocated, not modelled: only the date and jackpot are used.
      lastDrawDate = await deps.api.fetchLastDrawDate(rules);
    } else {
      const known = previous?.source === 'thelott' ? previous.draws : [];
      draws = await deps.api.fetchHistory(rules, historyDraws, known);
      if (draws.length === 0) throw new UpstreamError(`The Lott returned no ${rules.name} draws`, DEFAULT_THELOTT_API_BASE);
    }

    return {
      slug,
      rules,
      rulesSource: 'builtin',
      source: 'thelott',
      fetchedAt: new Date(nowMs()).toISOString(),
      draws,
      lastDrawDate: draws[0]?.date ?? lastDrawDate,
      jackpot: open?.get(slug)?.jackpot ?? null,
    };
  }

  return {
    fetchSnapshot(slug) {
      const running = inflight.get(slug);
      if (running) return running;

      const task = (async () => {
        const previous = await deps.readCache(slug).catch(() => null);
        if (previous && previous.source === 'thelott' && isFresh(previous)) return previous;
        try {
          return await refresh(slug, previous);
        } catch (error) {
          noteFailure(error);
          throw error;
        }
      })().finally(() => inflight.delete(slug));
      inflight.set(slug, task);
      return task;
    },
  };
}
