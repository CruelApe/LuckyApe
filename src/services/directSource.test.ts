import { BUILTIN_RULES } from '@shared/games';
import { generateSampleSnapshot } from '@shared/sample';
import type { OpenDrawInfo } from '@shared/thelott';
import type { Draw, GameRules, GameSlug, GameSnapshot } from '@shared/types';
import { UpstreamBlockedError, UpstreamError } from '@shared/upstream';
import { describe, expect, it, vi } from 'vitest';

import { createDirectSource, SNAPSHOT_TTL_MS, type DirectSourceDeps } from './directSource';

const NOW = new Date('2026-10-18T09:00:00Z');
const HOUR = 60 * 60_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const DRAWS: Draw[] = generateSampleSnapshot(BUILTIN_RULES.tattslotto, { now: NOW, draws: 12 }).draws;

const OPEN = new Map<GameSlug, OpenDrawInfo>([
  ['tattslotto', { jackpot: 6_000_000, drawDays: ['Wednesday', 'Saturday'] }],
  ['powerball', { jackpot: 10_000_000, drawDays: ['Thursday'] }],
  ['lucky-lotteries-super', { jackpot: 500_000, drawDays: ['Monday'] }],
]);

/** A failure like the HTTP client's: no response at all, with the underlying error as the cause. */
const networkError = () => new UpstreamError('Request failed: Network request failed', 'https://x.test', undefined, { cause: new Error('offline') });

function harness(overrides: Partial<DirectSourceDeps['api']> = {}, cache: Partial<Record<GameSlug, GameSnapshot>> = {}) {
  const api = {
    fetchOpenDraws: vi.fn(async (_slugs: GameSlug[]) => OPEN),
    fetchHistory: vi.fn(async (_rules: GameRules, _target: number, _known?: Draw[]) => DRAWS),
    fetchLastDrawDate: vi.fn(async (_rules: GameRules) => '2026-10-15' as string | null),
    ...overrides,
  };
  const source = createDirectSource({
    api,
    readCache: async (slug) => cache[slug] ?? null,
    now: () => NOW,
  });
  return { api, source };
}

const saved = (overrides: Partial<GameSnapshot> = {}): GameSnapshot => ({
  ...generateSampleSnapshot(BUILTIN_RULES.tattslotto, { now: NOW, draws: 12 }),
  source: 'thelott',
  fetchedAt: ago(30 * 60_000),
  jackpot: 1,
  ...overrides,
});

describe('createDirectSource', () => {
  it('builds a live snapshot from The Lott, with live draw days and jackpot', async () => {
    const { api, source } = harness();
    const snapshot = await source.fetchSnapshot('tattslotto');

    expect(snapshot).toMatchObject({
      slug: 'tattslotto',
      source: 'thelott',
      rulesSource: 'builtin',
      fetchedAt: NOW.toISOString(),
      jackpot: 6_000_000,
      lastDrawDate: DRAWS[0].date,
    });
    expect(snapshot.draws).toHaveLength(DRAWS.length);
    expect(snapshot.rules.drawDays).toEqual(['Wednesday', 'Saturday']);
    expect(snapshot.rules.main).toEqual(BUILTIN_RULES.tattslotto.main);
    expect(api.fetchHistory).toHaveBeenCalledWith(expect.objectContaining({ slug: 'tattslotto' }), 100, []);
  });

  it('keeps the built-in draw days when The Lott does not list any', async () => {
    const { source } = harness();
    const snapshot = await source.fetchSnapshot('oz-lotto'); // not in OPEN
    expect(snapshot.rules.drawDays).toEqual(BUILTIN_RULES['oz-lotto'].drawDays);
    expect(snapshot.jackpot).toBeNull();
  });

  it('reuses a recent saved snapshot without any request', async () => {
    const fresh = saved();
    const { api, source } = harness({}, { tattslotto: fresh });
    await expect(source.fetchSnapshot('tattslotto')).resolves.toBe(fresh);
    expect(api.fetchHistory).not.toHaveBeenCalled();
    expect(api.fetchOpenDraws).not.toHaveBeenCalled();
  });

  it('refreshes a stale snapshot incrementally from what is already on the phone', async () => {
    const stale = saved({ fetchedAt: ago(SNAPSHOT_TTL_MS + HOUR) });
    const { api, source } = harness({}, { tattslotto: stale });
    await source.fetchSnapshot('tattslotto');
    expect(api.fetchHistory).toHaveBeenCalledWith(expect.anything(), 100, stale.draws);
  });

  it('ignores a snapshot with a future timestamp rather than trusting it forever', async () => {
    const future = saved({ fetchedAt: new Date(NOW.getTime() + 10 * HOUR).toISOString() });
    const { api, source } = harness({}, { tattslotto: future });
    await source.fetchSnapshot('tattslotto');
    expect(api.fetchHistory).toHaveBeenCalledOnce();
  });

  it('never treats generated sample data as a base or as fresh', async () => {
    const sample = saved({ source: 'sample' });
    const { api, source } = harness({}, { tattslotto: sample });
    await source.fetchSnapshot('tattslotto');
    expect(api.fetchHistory).toHaveBeenCalledWith(expect.anything(), 100, []);
  });

  it('shares one jackpot request across games', async () => {
    const { api, source } = harness();
    await source.fetchSnapshot('tattslotto');
    await source.fetchSnapshot('powerball');
    expect(api.fetchOpenDraws).toHaveBeenCalledTimes(1);
  });

  it('merges concurrent requests for the same game into one', async () => {
    const { api, source } = harness();
    const [a, b] = await Promise.all([source.fetchSnapshot('tattslotto'), source.fetchSnapshot('tattslotto')]);
    expect(a).toBe(b);
    expect(api.fetchHistory).toHaveBeenCalledOnce();
  });

  it('uses only the last draw date for raffle games', async () => {
    const { api, source } = harness();
    const snapshot = await source.fetchSnapshot('lucky-lotteries-super');
    expect(snapshot).toMatchObject({ draws: [], lastDrawDate: '2026-10-15', jackpot: 500_000, source: 'thelott' });
    expect(api.fetchHistory).not.toHaveBeenCalled();
  });

  it('still returns draws when jackpots cannot be read, leaving the jackpot unknown', async () => {
    const { source } = harness({ fetchOpenDraws: vi.fn(async () => { throw new UpstreamError('boom', 'https://x.test', 500); }) });
    const snapshot = await source.fetchSnapshot('tattslotto');
    expect(snapshot.draws.length).toBeGreaterThan(0);
    expect(snapshot.jackpot).toBeNull();
  });

  it('rejects, so the caller falls back to saved data, when The Lott returns no draws', async () => {
    const { source } = harness({ fetchHistory: vi.fn(async () => []) });
    await expect(source.fetchSnapshot('tattslotto')).rejects.toThrow(/no .* draws/i);
  });

  it('passes upstream errors through unchanged', async () => {
    const blocked = new UpstreamBlockedError('refused', 'https://x.test', 403);
    const { source } = harness({ fetchHistory: vi.fn(async () => { throw blocked; }) });
    await expect(source.fetchSnapshot('tattslotto')).rejects.toBe(blocked);
  });

  describe('when the phone is offline', () => {
    it('fails the remaining games immediately instead of retrying each one', async () => {
      const { api, source } = harness({ fetchOpenDraws: vi.fn(async () => { throw networkError(); }) });
      await expect(source.fetchSnapshot('tattslotto')).rejects.toThrow(/No network/);
      await expect(source.fetchSnapshot('powerball')).rejects.toThrow(/No network/);
      await expect(source.fetchSnapshot('oz-lotto')).rejects.toThrow(/No network/);
      expect(api.fetchOpenDraws).toHaveBeenCalledOnce();
      expect(api.fetchHistory).not.toHaveBeenCalled();
    });

    it('also notices when the history request is the one that fails', async () => {
      const { api, source } = harness({ fetchHistory: vi.fn(async () => { throw networkError(); }) });
      await expect(source.fetchSnapshot('tattslotto')).rejects.toBeInstanceOf(UpstreamError);
      await expect(source.fetchSnapshot('powerball')).rejects.toThrow(/No network/);
      expect(api.fetchHistory).toHaveBeenCalledOnce();
    });

    it('does not treat a changed API shape as being offline', async () => {
      const shape = new UpstreamError('Only 0 of 10 draws matched the expected format', 'https://x.test');
      const fetchHistory = vi.fn(async (_rules: GameRules, _target: number, _known?: Draw[]) => DRAWS);
      fetchHistory.mockRejectedValueOnce(shape);
      const { api, source } = harness({ fetchHistory });
      await expect(source.fetchSnapshot('tattslotto')).rejects.toBe(shape);
      await expect(source.fetchSnapshot('powerball')).resolves.toMatchObject({ source: 'thelott' });
      expect(api.fetchHistory).toHaveBeenCalledTimes(2);
    });

    it('serves a fresh saved snapshot even while offline', async () => {
      const fresh = saved();
      const { source } = harness({ fetchOpenDraws: vi.fn(async () => { throw networkError(); }) }, { tattslotto: fresh });
      await expect(source.fetchSnapshot('tattslotto')).resolves.toBe(fresh);
    });
  });
});
