import { DEFAULT_THELOTT_API_BASE, DEFAULT_THELOTT_COMPANY, TheLottApi } from '@shared/thelott';
import { createHttpClient } from '@shared/upstream';
import type { GameSlug } from '@shared/types';

import { APP_INFO, resolveApiBase } from '@/constants/config';

import { fetchSnapshot } from './api';
import { createDirectSource } from './directSource';
import { loadGame, type GameDataDeps, type LoadedGame } from './gameData';
import { createLiveFetcher } from './liveData';
import { readCachedSnapshot, writeCachedSnapshot } from './snapshotCache';

const warn = (message: string, error?: unknown) => console.warn(`[LuckyApe] ${message}`, error ?? '');

/** A scraper service is optional now, so do not make a phone wait long on one that is not there. */
const SERVER_TIMEOUT_MS = 10_000;

const lott = createDirectSource({
  api: new TheLottApi(
    createHttpClient({
      userAgent: `LuckyApe/${APP_INFO.version} (+${APP_INFO.repoUrl}; independent statistical tool)`,
      requestDelayMs: 600,
      requestTimeoutMs: 15_000,
    }),
    { thelottApiBase: DEFAULT_THELOTT_API_BASE, thelottCompany: DEFAULT_THELOTT_COMPANY },
  ),
  readCache: readCachedSnapshot,
});

const deps: GameDataDeps = {
  fetchSnapshot: createLiveFetcher({
    serverUrl: resolveApiBase,
    fetchFromServer: (slug, baseUrl) => fetchSnapshot(slug, { baseUrl, timeoutMs: SERVER_TIMEOUT_MS }),
    fetchFromLott: lott.fetchSnapshot,
    warn,
  }),
  readCache: readCachedSnapshot,
  writeCache: writeCachedSnapshot,
  warn,
};

/** The app's real `loadGame`: live data (scraper service if configured, else The Lott directly), then the on-device cache, then sample data. */
export const loadGameRuntime = (slug: GameSlug): Promise<LoadedGame> => loadGame(slug, deps);
