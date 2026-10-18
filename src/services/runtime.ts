import type { GameSlug } from '@shared/types';

import { resolveApiBase } from '@/constants/config';

import { fetchSnapshot } from './api';
import { loadGame, type GameDataDeps, type LoadedGame } from './gameData';
import { readCachedSnapshot, writeCachedSnapshot } from './snapshotCache';

const deps: GameDataDeps = {
  fetchSnapshot: (slug) => fetchSnapshot(slug, { baseUrl: resolveApiBase() }),
  readCache: readCachedSnapshot,
  writeCache: writeCachedSnapshot,
  warn: (message, error) => console.warn(`[LuckyApe] ${message}`, error ?? ''),
};

/** The app's real `loadGame`: scraper service, then on-device cache, then sample data. */
export const loadGameRuntime = (slug: GameSlug): Promise<LoadedGame> => loadGame(slug, deps);
