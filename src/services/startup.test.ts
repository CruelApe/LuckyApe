import { BUILTIN_RULES } from '@shared/games';
import { generateSampleSnapshot } from '@shared/sample';
import { GAME_SLUGS, type GameSlug } from '@shared/types';
import { describe, expect, it, vi } from 'vitest';

import type { LoadedGame, SnapshotOrigin } from './gameData';
import { preloadPercent, type PreloadPhase } from './preload';
import { runStartup, type StartupDeps } from './startup';

const NOW = new Date('2026-10-18T09:00:00Z');

function harness(options: { origin?: (slug: GameSlug) => SnapshotOrigin; minDurationMs?: number } = {}) {
  let clock = 0;
  const waits: number[] = [];
  const analysed: string[] = [];
  const deps: StartupDeps = {
    slugs: GAME_SLUGS,
    gameName: (slug) => BUILTIN_RULES[slug].name,
    load: async (slug): Promise<LoadedGame> => {
      clock += 100; // each game takes 100 ms
      return {
        snapshot: generateSampleSnapshot(BUILTIN_RULES[slug], { now: NOW, draws: 12 }),
        origin: options.origin?.(slug) ?? 'live',
        error: null,
      };
    },
    analyze: (snapshot) => analysed.push(snapshot.slug),
    nextFrame: async () => undefined,
    wait: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
    now: () => clock,
    minDurationMs: options.minDurationMs ?? 1000,
  };
  return { deps, waits, analysed };
}

describe('runStartup', () => {
  it('fetches every game in order, then analyses each, then finishes', async () => {
    const { deps, analysed } = harness();
    const phases: PreloadPhase[] = [];
    const result = await runStartup(deps, (p) => phases.push(p), () => false);

    expect(result).toEqual({ completed: true, offline: false });
    expect(phases.filter((p) => p.kind === 'fetch' && p.game).map((p) => (p as { game: string }).game)).toEqual(
      GAME_SLUGS.map((s) => BUILTIN_RULES[s].name),
    );
    expect(phases.filter((p) => p.kind === 'analyze')).toHaveLength(GAME_SLUGS.length);
    expect(phases.at(-1)).toEqual({ kind: 'done', offline: false });
    expect(analysed).toEqual([...GAME_SLUGS]);
  });

  it('drives a bar that only moves forward and ends at exactly 100', async () => {
    const { deps } = harness();
    const percents: number[] = [];
    await runStartup(deps, (p) => percents.push(preloadPercent(p)), () => false);
    for (let i = 1; i < percents.length; i++) expect(percents[i]).toBeGreaterThanOrEqual(percents[i - 1]);
    expect(percents.at(-1)).toBe(100);
    expect(percents.slice(0, -1).every((p) => p < 100)).toBe(true);
  });

  it('holds the splash for the minimum duration when loading is fast', async () => {
    const { deps, waits } = harness({ minDurationMs: 2000 });
    await runStartup(deps, () => undefined, () => false);
    // 7 games × 100 ms = 700 ms of work, so it waits out the remaining 1300 ms
    expect(waits).toEqual([1300]);
  });

  it('does not wait extra when loading already took longer than the minimum', async () => {
    const { deps, waits } = harness({ minDurationMs: 300 });
    await runStartup(deps, () => undefined, () => false);
    expect(waits).toEqual([0]);
  });

  it('reports offline when any game came from cache or sample data', async () => {
    const { deps } = harness({ origin: (slug) => (slug === 'powerball' ? 'cached' : 'live') });
    const result = await runStartup(deps, () => undefined, () => false);
    expect(result.offline).toBe(true);
  });

  it('stops cleanly, without further updates, once cancelled', async () => {
    const { deps, analysed } = harness();
    let cancelled = false;
    const phases: PreloadPhase[] = [];
    const result = await runStartup(
      deps,
      (p) => {
        phases.push(p);
        if (p.kind === 'fetch' && p.done === 2) cancelled = true; // the screen unmounts mid-load
      },
      () => cancelled,
    );
    expect(result.completed).toBe(false);
    expect(phases.at(-1)?.kind).toBe('fetch');
    expect(phases.some((p) => p.kind === 'done')).toBe(false);
    expect(analysed).toEqual([]);
  });

  it('does nothing if cancelled before it starts', async () => {
    const { deps } = harness();
    const onPhase = vi.fn();
    const result = await runStartup(deps, onPhase, () => true);
    expect(result.completed).toBe(false);
    expect(onPhase).not.toHaveBeenCalled();
  });
});
