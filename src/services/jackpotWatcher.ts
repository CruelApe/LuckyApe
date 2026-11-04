import { GAME_SLUGS } from '@shared/types';
import type { QueryClient } from '@tanstack/react-query';

import type { LoadedGame } from './gameData';
import { GAME_QUERY_ROOT, gameQueryKey } from './queryKeys';

const isLoadedGame = (value: unknown): value is LoadedGame =>
  typeof value === 'object' && value !== null && 'snapshot' in value && 'origin' in value;

/**
 * Calls `onGame` each time a game's data finishes loading, wherever that was started (the splash,
 * pull-to-refresh, opening a game), so the jackpot check never needs its own fetches. Returns an unsubscribe.
 */
export function watchGameQueries(queryClient: QueryClient, onGame: (game: LoadedGame) => void): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    if (event.query.queryKey[0] !== GAME_QUERY_ROOT) return;
    const data: unknown = event.query.state.data;
    if (isLoadedGame(data)) onGame(data);
  });
}

/** Whatever games are already loaded, for checking again after a setting changes. */
export function cachedGames(queryClient: QueryClient): LoadedGame[] {
  return GAME_SLUGS.flatMap((slug) => {
    const data: unknown = queryClient.getQueryData(gameQueryKey(slug));
    return isLoadedGame(data) ? [data] : [];
  });
}
