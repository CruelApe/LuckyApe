import { BUILTIN_RULES } from '@shared/games';
import { generateSampleSnapshot } from '@shared/sample';
import type { GameSlug, GameSnapshot } from '@shared/types';

/**
 * - `live`    – fresh from the data server.
 * - `cached`  – the server was unreachable; this is the last good copy from this device.
 * - `offline` – nothing else available; generated sample data (never real results).
 */
export type SnapshotOrigin = 'live' | 'cached' | 'offline';

export interface LoadedGame {
  snapshot: GameSnapshot;
  origin: SnapshotOrigin;
  /** Why the server could not be used, when it could not. */
  error: string | null;
}

export interface GameDataDeps {
  fetchSnapshot(slug: GameSlug): Promise<GameSnapshot>;
  readCache(slug: GameSlug): Promise<GameSnapshot | null>;
  writeCache(snapshot: GameSnapshot): Promise<void>;
  now?: () => Date;
  warn?: (message: string, error?: unknown) => void;
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Never rejects: the app must always have something to show. The tiers are strictly ordered so
 * generated sample data can never displace real data that is available.
 */
export async function loadGame(slug: GameSlug, deps: GameDataDeps): Promise<LoadedGame> {
  const warn = deps.warn ?? (() => undefined);
  let reason: string;

  try {
    const snapshot = await deps.fetchSnapshot(slug);
    // A failed cache write must not hide fresh data from the user.
    await deps.writeCache(snapshot).catch((error) => warn(`Could not cache ${slug}`, error));
    return { snapshot, origin: 'live', error: null };
  } catch (error) {
    reason = describe(error);
    warn(`Data server unavailable for ${slug}: ${reason}`, error);
  }

  try {
    const cached = await deps.readCache(slug);
    if (cached) return { snapshot: cached, origin: 'cached', error: reason };
  } catch (error) {
    warn(`Could not read cached ${slug}`, error);
  }

  const sample = generateSampleSnapshot(BUILTIN_RULES[slug], { now: deps.now?.() });
  return { snapshot: sample, origin: 'offline', error: reason };
}
