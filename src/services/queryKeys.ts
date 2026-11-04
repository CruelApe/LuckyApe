import type { GameSlug } from '@shared/types';

/** Every game's snapshot lives under `['game', slug]`; anything that watches the cache keys off the root. */
export const GAME_QUERY_ROOT = 'game';

export const gameQueryKey = (slug: GameSlug) => [GAME_QUERY_ROOT, slug] as const;
