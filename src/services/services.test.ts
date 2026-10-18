import { BUILTIN_RULES } from '@shared/games';
import { generateSampleSnapshot } from '@shared/sample';
import type { GameSnapshot } from '@shared/types';
import { describe, expect, it, vi } from 'vitest';

import { analyzeGame, isPickGame } from '@/lib';

import { ApiError, fetchSnapshot, isGameSnapshot } from './api';
import { loadGame, type GameDataDeps } from './gameData';

const NOW = new Date('2026-10-18T09:00:00Z');
const live = (slug: 'tattslotto' | 'super-66' = 'tattslotto'): GameSnapshot => ({
  ...generateSampleSnapshot(BUILTIN_RULES[slug], { now: NOW }),
  source: 'thelott',
  jackpot: 6_000_000,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('isGameSnapshot', () => {
  it('accepts a real snapshot and rejects mismatched or malformed ones', () => {
    const snapshot = live();
    expect(isGameSnapshot(snapshot, 'tattslotto')).toBe(true);
    expect(isGameSnapshot(snapshot, 'powerball')).toBe(false);
    expect(isGameSnapshot({ ...snapshot, draws: 'x' }, 'tattslotto')).toBe(false);
    expect(isGameSnapshot({ ...snapshot, source: 'mystery' }, 'tattslotto')).toBe(false);
    expect(isGameSnapshot({ ...snapshot, rules: null }, 'tattslotto')).toBe(false);
    expect(isGameSnapshot(null, 'tattslotto')).toBe(false);
    expect(isGameSnapshot('nope', 'tattslotto')).toBe(false);
  });
});

describe('fetchSnapshot', () => {
  const base = 'http://server.test:8787';

  it('requests the game and returns a validated snapshot', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) => json(live()));
    const snapshot = await fetchSnapshot('tattslotto', { baseUrl: base, fetchImpl: fetchImpl as never });
    expect(snapshot.slug).toBe('tattslotto');
    expect(fetchImpl.mock.calls[0][0]).toBe('http://server.test:8787/api/games/tattslotto');
  });

  it('refuses to run without a configured server', async () => {
    await expect(fetchSnapshot('tattslotto', { baseUrl: null })).rejects.toThrow(/No data server/);
  });

  it('reports HTTP errors with their status', async () => {
    const fetchImpl = async () => json({ error: 'Bad Gateway' }, 502);
    await expect(fetchSnapshot('tattslotto', { baseUrl: base, fetchImpl: fetchImpl as never })).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
    });
  });

  it('rejects a response for the wrong game', async () => {
    const fetchImpl = async () => json(live('super-66'));
    await expect(fetchSnapshot('tattslotto', { baseUrl: base, fetchImpl: fetchImpl as never })).rejects.toThrow(
      /Unexpected response/,
    );
  });

  it('wraps network failures', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Network request failed');
    };
    const error = await fetchSnapshot('tattslotto', { baseUrl: base, fetchImpl: fetchImpl as never }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toMatch(/Could not reach the data server: Network request failed/);
  });

  it('times out slow servers', async () => {
    const fetchImpl = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    await expect(
      fetchSnapshot('tattslotto', { baseUrl: base, timeoutMs: 20, fetchImpl: fetchImpl as never }),
    ).rejects.toThrow(/Timed out fetching tattslotto/);
  });
});

describe('loadGame', () => {
  const deps = (overrides: Partial<GameDataDeps> = {}): GameDataDeps => ({
    fetchSnapshot: async () => live(),
    readCache: async () => null,
    writeCache: async () => undefined,
    now: () => NOW,
    ...overrides,
  });

  it('prefers live data and caches it', async () => {
    const writeCache = vi.fn(async () => undefined);
    const result = await loadGame('tattslotto', deps({ writeCache }));
    expect(result).toMatchObject({ origin: 'live', error: null });
    expect(result.snapshot.source).toBe('thelott');
    expect(writeCache).toHaveBeenCalledWith(result.snapshot);
  });

  it('still returns live data if caching it fails', async () => {
    const warn = vi.fn();
    const result = await loadGame(
      'tattslotto',
      deps({
        writeCache: async () => {
          throw new Error('disk full');
        },
        warn,
      }),
    );
    expect(result.origin).toBe('live');
    expect(warn).toHaveBeenCalledWith('Could not cache tattslotto', expect.any(Error));
  });

  it('falls back to the cached copy, with the reason, when the server is down', async () => {
    const cached = live();
    const result = await loadGame(
      'tattslotto',
      deps({
        fetchSnapshot: async () => {
          throw new ApiError('Could not reach the data server: offline');
        },
        readCache: async () => cached,
      }),
    );
    expect(result).toEqual({ snapshot: cached, origin: 'cached', error: 'Could not reach the data server: offline' });
  });

  it('falls back to labelled sample data only when nothing else exists', async () => {
    const result = await loadGame(
      'powerball',
      deps({
        fetchSnapshot: async () => {
          throw new ApiError('down');
        },
      }),
    );
    expect(result.origin).toBe('offline');
    expect(result.snapshot.source).toBe('sample');
    expect(result.snapshot.jackpot).toBeNull();
    expect(result.error).toBe('down');
  });

  it('treats an unreadable cache as a miss and says so', async () => {
    const warn = vi.fn();
    const result = await loadGame(
      'tattslotto',
      deps({
        fetchSnapshot: async () => {
          throw new ApiError('down');
        },
        readCache: async () => {
          throw new Error('corrupt');
        },
        warn,
      }),
    );
    expect(result.origin).toBe('offline');
    expect(warn).toHaveBeenCalledWith('Could not read cached tattslotto', expect.any(Error));
  });
});

describe('analysis of a loaded snapshot', () => {
  it('works for every pick game, from live-shaped data', () => {
    for (const slug of ['tattslotto', 'weekday-windfall', 'oz-lotto', 'powerball'] as const) {
      const snapshot = generateSampleSnapshot(BUILTIN_RULES[slug], { now: NOW });
      expect(isPickGame(snapshot.rules)).toBe(true);
      if (!isPickGame(snapshot.rules)) continue;
      const analysis = analyzeGame(snapshot.rules, snapshot.draws);
      expect(analysis.drawCount).toBe(snapshot.draws.length);
      expect(analysis.main.stats).toHaveLength(snapshot.rules.main.pool);
    }
  });
});
