import { BUILTIN_RULES } from '@shared/games';
import { generateSampleSnapshot } from '@shared/sample';
import type { GameSnapshot } from '@shared/types';
import { describe, expect, it, vi } from 'vitest';

import { createLiveFetcher, type LiveFetcherDeps } from './liveData';

const NOW = new Date('2026-10-18T09:00:00Z');
const snapshot = (source: GameSnapshot['source']): GameSnapshot => ({
  ...generateSampleSnapshot(BUILTIN_RULES.tattslotto, { now: NOW, draws: 5 }),
  source,
});

function harness(overrides: Partial<LiveFetcherDeps> = {}) {
  const fromServer = vi.fn(async () => snapshot('thelott'));
  const fromLott = vi.fn(async () => snapshot('thelott'));
  const warn = vi.fn();
  const fetcher = createLiveFetcher({
    serverUrl: () => null,
    fetchFromServer: fromServer,
    fetchFromLott: fromLott,
    warn,
    ...overrides,
  });
  return { fetcher, fromServer, fromLott, warn };
}

describe('createLiveFetcher', () => {
  it('goes straight to The Lott when no scraper service is configured', async () => {
    const { fetcher, fromServer, fromLott, warn } = harness();
    await fetcher('tattslotto');
    expect(fromLott).toHaveBeenCalledWith('tattslotto');
    expect(fromServer).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('prefers a configured scraper service', async () => {
    const { fetcher, fromServer, fromLott } = harness({ serverUrl: () => 'http://192.168.1.20:8787' });
    await fetcher('tattslotto');
    expect(fromServer).toHaveBeenCalledWith('tattslotto', 'http://192.168.1.20:8787');
    expect(fromLott).not.toHaveBeenCalled();
  });

  it('falls back to The Lott, and says so, when the service is down', async () => {
    const { fetcher, fromLott, warn } = harness({
      serverUrl: () => 'http://192.168.1.20:8787',
      fetchFromServer: vi.fn(async () => {
        throw new Error('Could not reach the data server');
      }),
    });
    await expect(fetcher('tattslotto')).resolves.toMatchObject({ source: 'thelott' });
    expect(fromLott).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/unavailable/), expect.any(Error));
  });

  it('does not accept sample data from the service when The Lott can be asked directly', async () => {
    const { fetcher, fromLott } = harness({
      serverUrl: () => 'http://192.168.1.20:8787',
      fetchFromServer: vi.fn(async () => snapshot('sample')),
    });
    await expect(fetcher('tattslotto')).resolves.toMatchObject({ source: 'thelott' });
    expect(fromLott).toHaveBeenCalledOnce();
  });

  it('lets a Lott failure reach the caller, which then falls back to saved data', async () => {
    const failure = new Error('offline');
    const { fetcher } = harness({ fetchFromLott: vi.fn(async () => Promise.reject(failure)) });
    await expect(fetcher('tattslotto')).rejects.toBe(failure);
  });
});
