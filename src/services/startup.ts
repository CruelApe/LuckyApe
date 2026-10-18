import type { GameSlug, GameSnapshot } from '@shared/types';

import type { LoadedGame } from './gameData';
import type { PreloadPhase } from './preload';

export interface StartupDeps {
  slugs: readonly GameSlug[];
  gameName(slug: GameSlug): string;
  /** Load one game (live → cache → sample). Must not reject. */
  load(slug: GameSlug): Promise<LoadedGame>;
  /** Compute (and cache) the probability analysis for a snapshot. */
  analyze(snapshot: GameSnapshot): void;
  /** Resolve on the next frame, so progress updates can paint between games. */
  nextFrame(): Promise<void>;
  wait(ms: number): Promise<void>;
  now(): number;
  /** Keep the splash up at least this long, even when everything is cached. */
  minDurationMs: number;
}

export interface StartupResult {
  /** False if `isCancelled` stopped the run early. */
  completed: boolean;
  /** True if any game came from the device cache or sample data rather than live. */
  offline: boolean;
}

/**
 * The splash screen's work: fetch every game's draw history, then compute its probability
 * distributions, reporting each step through `onPhase`. Kept out of the component so it can be
 * tested, and so a cancelled run (screen unmounted) stops cleanly without further updates.
 */
export async function runStartup(
  deps: StartupDeps,
  onPhase: (phase: PreloadPhase) => void,
  isCancelled: () => boolean,
): Promise<StartupResult> {
  const startedAt = deps.now();
  const total = deps.slugs.length;
  const loaded: LoadedGame[] = [];
  const cancelled: StartupResult = { completed: false, offline: false };

  await deps.nextFrame(); // let the splash itself paint before any work begins
  if (isCancelled()) return cancelled;

  for (const [index, slug] of deps.slugs.entries()) {
    onPhase({ kind: 'fetch', done: index, total, game: deps.gameName(slug) });
    loaded.push(await deps.load(slug));
    if (isCancelled()) return cancelled;
  }
  onPhase({ kind: 'fetch', done: total, total, game: '' });

  for (const [index, { snapshot }] of loaded.entries()) {
    await deps.nextFrame();
    deps.analyze(snapshot);
    if (isCancelled()) return cancelled;
    onPhase({ kind: 'analyze', done: index + 1, total, game: snapshot.rules.name });
  }

  await deps.wait(Math.max(0, deps.minDurationMs - (deps.now() - startedAt)));
  if (isCancelled()) return cancelled;

  const offline = loaded.some((game) => game.origin !== 'live');
  onPhase({ kind: 'done', offline });
  return { completed: true, offline };
}
