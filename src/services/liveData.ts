import type { GameSlug, GameSnapshot } from '@shared/types';

export interface LiveFetcherDeps {
  /** The scraper service to prefer, or null when none is configured (the normal case for an installed app). */
  serverUrl(): string | null;
  fetchFromServer(slug: GameSlug, baseUrl: string): Promise<GameSnapshot>;
  fetchFromLott(slug: GameSlug): Promise<GameSnapshot>;
  warn(message: string, error?: unknown): void;
}

/**
 * Where live data comes from: a configured scraper service first (development, or a build with
 * `EXPO_PUBLIC_API_URL`), otherwise, or when the service cannot help, The Lott directly.
 * A service that only has generated sample data does not count as helping.
 */
export function createLiveFetcher(deps: LiveFetcherDeps): (slug: GameSlug) => Promise<GameSnapshot> {
  return async (slug) => {
    const baseUrl = deps.serverUrl();
    if (baseUrl) {
      try {
        const snapshot = await deps.fetchFromServer(slug, baseUrl);
        if (snapshot.source !== 'sample') return snapshot;
        deps.warn(`Scraper service only had sample data for ${slug}; trying The Lott directly`);
      } catch (error) {
        deps.warn(`Scraper service unavailable for ${slug}; trying The Lott directly`, error);
      }
    }
    return deps.fetchFromLott(slug);
  };
}
