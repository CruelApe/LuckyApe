import type { GameSnapshot } from '@shared/types';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import type { LoadedGame } from './gameData';
import { cachedGames, watchGameQueries } from './jackpotWatcher';
import { gameQueryKey } from './queryKeys';

const loaded = (jackpot: number): LoadedGame => ({
  snapshot: { slug: 'powerball', jackpot, source: 'thelott' } as GameSnapshot,
  origin: 'live',
  error: null,
});

describe('watchGameQueries', () => {
  it('reports each game as its data finishes loading', async () => {
    const queryClient = new QueryClient();
    const seen = vi.fn();
    const stop = watchGameQueries(queryClient, seen);

    await queryClient.fetchQuery({ queryKey: gameQueryKey('powerball'), queryFn: async () => loaded(60_000_000) });
    expect(seen).toHaveBeenCalledOnce();
    expect(seen.mock.calls[0][0].snapshot.jackpot).toBe(60_000_000);

    // A refresh is a new success, and so is reported again.
    await queryClient.fetchQuery({ queryKey: gameQueryKey('powerball'), queryFn: async () => loaded(70_000_000), staleTime: 0 });
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
  });

  it('ignores other queries, failures and data of the wrong shape', async () => {
    const queryClient = new QueryClient();
    const seen = vi.fn();
    const stop = watchGameQueries(queryClient, seen);

    await queryClient.fetchQuery({ queryKey: ['update'], queryFn: async () => ({ status: 'current' }) });
    await queryClient.fetchQuery({ queryKey: gameQueryKey('powerball'), queryFn: async () => 'not a game' });
    await queryClient.fetchQuery({ queryKey: gameQueryKey('oz-lotto'), queryFn: async () => Promise.reject(new Error('x')) }).catch(() => undefined);
    expect(seen).not.toHaveBeenCalled();
    stop();
  });

  it('stops reporting once unsubscribed', async () => {
    const queryClient = new QueryClient();
    const seen = vi.fn();
    watchGameQueries(queryClient, seen)();
    await queryClient.fetchQuery({ queryKey: gameQueryKey('powerball'), queryFn: async () => loaded(60_000_000) });
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('cachedGames', () => {
  it('returns the games already in the cache', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(gameQueryKey('powerball'), loaded(60_000_000));
    queryClient.setQueryData(gameQueryKey('oz-lotto'), 'junk');
    expect(cachedGames(queryClient).map((game) => game.snapshot.slug)).toEqual(['powerball']);
  });
});
