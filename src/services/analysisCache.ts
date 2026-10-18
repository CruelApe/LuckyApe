import type { GameSnapshot } from '@shared/types';

import { analyzeGame, isPickGame, type GameAnalysis } from '@/lib';

const cache = new WeakMap<GameSnapshot, GameAnalysis | null>();

/**
 * Probability analysis for a snapshot, computed once per snapshot object. The splash screen
 * warms this for every game so opening a game is instant. Allocated games have no analysis.
 */
export function analysisFor(snapshot: GameSnapshot): GameAnalysis | null {
  if (cache.has(snapshot)) return cache.get(snapshot) ?? null;
  const analysis = isPickGame(snapshot.rules) ? analyzeGame(snapshot.rules, snapshot.draws) : null;
  cache.set(snapshot, analysis);
  return analysis;
}
