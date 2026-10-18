import type { GameSlug } from '@shared/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { analysisFor } from '@/services/analysisCache';
import { loadGameRuntime } from '@/services/runtime';

export const gameQueryKey = (slug: GameSlug) => ['game', slug] as const;

/** A game's snapshot (live → cached → sample) with its probability analysis. */
export function useGame(slug: GameSlug) {
  const query = useQuery({
    queryKey: gameQueryKey(slug),
    queryFn: () => loadGameRuntime(slug),
  });
  const snapshot = query.data?.snapshot;
  const analysis = useMemo(() => (snapshot ? analysisFor(snapshot) : null), [snapshot]);
  return { ...query, loaded: query.data, analysis };
}
