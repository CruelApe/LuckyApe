import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UpstreamError } from '../src/http';
import { GameDataService } from '../src/service';
import { SnapshotStore } from '../src/store';
import type { SourceName } from '../src/config';
import { captureLogger, fakeHttp, fixture, fixtureJson, testConfig, type FakeHttp } from './helpers';

const HOUR = 3_600_000;

/** The Lott as captured, served from fixtures. `down` flips it into a failing upstream. */
function fakeLott(options: { page?: (url: string) => string } = {}) {
  const state = { down: false };
  const http: FakeHttp = fakeHttp({
    get: (url) => {
      if (state.down) throw new UpstreamError('network down', url);
      return options.page ? options.page(url) : fixture(`how-to-play-${url.split('/').at(-2)}.html`);
    },
    post: (url, body) => {
      if (state.down) throw new UpstreamError('network down', url);
      if (url.endsWith('latestresults')) return fixtureJson(`latest-${body.OptionalProductFilter[0]}.json`);
      if (url.endsWith('drawrange')) return { Success: true, Draws: [] };
      if (url.endsWith('opendraws')) return fixtureJson('opendraws.json');
      throw new Error(`unexpected ${url}`);
    },
  });
  return { http, state };
}

describe('GameDataService', () => {
  let dir: string;
  let clock: number;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'luckyape-svc-'));
    clock = Date.parse('2026-10-18T08:00:00Z');
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function make(http: FakeHttp, sourceOrder: SourceName[] = ['import', 'thelott', 'sample']) {
    const log = captureLogger();
    const store = new SnapshotStore(path.join(dir, 'cache', 'snapshots.json'));
    const service = new GameDataService({
      config: testConfig({ dataDir: dir, historyDraws: 10, sourceOrder }),
      http,
      store,
      log,
      now: () => new Date(clock),
    });
    return { service, log, store };
  }

  const latestCalls = (http: FakeHttp) => http.calls.filter((c) => c.url.endsWith('latestresults')).length;

  it('builds a snapshot from live data, confirmed rules and the open-draw jackpot', async () => {
    const { http } = fakeLott();
    const { service } = make(http);
    const snapshot = await service.getSnapshot('tattslotto');
    expect(snapshot).toMatchObject({
      slug: 'tattslotto',
      source: 'thelott',
      rulesSource: 'scraped',
      jackpot: 6_000_000,
      fetchedAt: '2026-10-18T08:00:00.000Z',
    });
    expect(snapshot.draws.map((d) => d.drawNumber)).toEqual([4721, 4719, 4717]);
    expect(service.status().find((s) => s.slug === 'tattslotto')).toMatchObject({ source: 'thelott', draws: 3, stale: false, lastError: null });
  });

  it('serves fresh data from cache without touching the network again', async () => {
    const { http } = fakeLott();
    const { service } = make(http);
    await service.getSnapshot('tattslotto');
    const before = http.calls.length;
    await service.getSnapshot('tattslotto');
    expect(http.calls.length).toBe(before);
  });

  it('shares one refresh between concurrent callers', async () => {
    const { http } = fakeLott();
    const { service } = make(http);
    await Promise.all([service.getSnapshot('oz-lotto'), service.getSnapshot('oz-lotto'), service.getSnapshot('oz-lotto')]);
    expect(latestCalls(http)).toBe(1);
  });

  it('persists snapshots and reloads them on the next start', async () => {
    const { http } = fakeLott();
    const first = make(http);
    await first.service.getSnapshot('powerball');

    const offline = fakeHttp({});
    const second = make(offline);
    await second.service.init();
    const snapshot = await second.service.getSnapshot('powerball');
    expect(snapshot.source).toBe('thelott');
    expect(snapshot.draws[0].powerball).toBe(16);
    expect(offline.calls).toHaveLength(0);
  });

  it('serves stale data immediately and refreshes once in the background', async () => {
    const { http } = fakeLott();
    const { service } = make(http);
    const first = await service.getSnapshot('tattslotto');
    clock += 7 * HOUR; // past the 6 h TTL
    const calls = latestCalls(http);

    const stale = await service.getSnapshot('tattslotto');
    expect(stale.fetchedAt).toBe(first.fetchedAt); // returned instantly, not waited for
    const refreshed = await service.refresh('tattslotto'); // joins the in-flight refresh
    expect(refreshed.fetchedAt).not.toBe(first.fetchedAt);
    expect(latestCalls(http)).toBe(calls + 1);
  });

  it('re-checks the how-to-play page at most once a day', async () => {
    const { http } = fakeLott();
    const { service } = make(http);
    await service.getSnapshot('tattslotto');
    clock += 7 * HOUR;
    await service.refresh('tattslotto');
    expect(http.calls.filter((c) => c.method === 'GET')).toHaveLength(1);
    clock += 20 * HOUR;
    await service.refresh('tattslotto');
    expect(http.calls.filter((c) => c.method === 'GET')).toHaveLength(2);
  });

  it('falls back to clearly-labelled sample data when The Lott cannot be reached', async () => {
    const { http, state } = fakeLott();
    state.down = true;
    const { service, log } = make(http);
    const snapshot = await service.getSnapshot('tattslotto');
    expect(snapshot).toMatchObject({ source: 'sample', rulesSource: 'builtin', jackpot: null });
    expect(snapshot.draws).toHaveLength(10);
    expect(service.status().find((s) => s.slug === 'tattslotto')?.lastError).toMatch(/thelott: .*network down/);
    expect(log.lines.some((l) => l.level === 'warn' && /source "thelott" failed/.test(l.text))).toBe(true);
  });

  it('retries sample data soon instead of waiting out the full TTL', async () => {
    const { http, state } = fakeLott();
    state.down = true;
    const { service } = make(http);
    expect((await service.getSnapshot('tattslotto')).source).toBe('sample');
    state.down = false;
    clock += 10 * 60_000; // 10 minutes — far less than the 6 h TTL
    await service.getSnapshot('tattslotto'); // returns the stale sample, kicks off a refresh
    expect((await service.refresh('tattslotto')).source).toBe('thelott');
  });

  it('never replaces real data with sample data after a failed refresh', async () => {
    const { http, state } = fakeLott();
    const { service, log } = make(http);
    const real = await service.getSnapshot('tattslotto');

    clock += 7 * HOUR;
    state.down = true;
    const kept = await service.refresh('tattslotto');
    expect(kept).toEqual(real);
    expect(kept.source).toBe('thelott');
    expect(service.status().find((s) => s.slug === 'tattslotto')).toMatchObject({ stale: true });
    expect(service.status().find((s) => s.slug === 'tattslotto')?.lastError).toMatch(/network down/);
    expect(log.lines.some((l) => /keeping previous thelott data/.test(l.text))).toBe(true);
  });

  it('prefers user-imported history over live data', async () => {
    const { http } = fakeLott();
    await mkdir(path.join(dir, 'imports'));
    await writeFile(
      path.join(dir, 'imports', 'tattslotto.csv'),
      'date,n1,n2,n3,n4,n5,n6,s1,s2\n2026-10-17,1,2,3,4,5,6,7,8\n2026-10-10,2,3,4,5,6,9,10,11',
    );
    const { service } = make(http);
    const snapshot = await service.getSnapshot('tattslotto');
    expect(snapshot.source).toBe('import');
    expect(snapshot.draws).toHaveLength(2);
    expect(latestCalls(http)).toBe(0);
    expect(snapshot.jackpot).toBe(6_000_000); // still the real current jackpot
  });

  it('never contacts The Lott when that source is not enabled', async () => {
    const { http } = fakeLott();
    const { service } = make(http, ['import', 'sample']);
    const snapshot = await service.getSnapshot('powerball');
    expect(snapshot).toMatchObject({ source: 'sample', jackpot: null, rulesSource: 'builtin' });
    expect(http.calls).toHaveLength(0);
  });

  it('keeps going if the rules page cannot be read', async () => {
    const { http } = fakeLott({
      page: () => {
        throw new UpstreamError('page unavailable', 'x');
      },
    });
    const { service, log } = make(http);
    const snapshot = await service.getSnapshot('tattslotto');
    expect(snapshot).toMatchObject({ source: 'thelott', rulesSource: 'builtin' });
    expect(log.lines.some((l) => /Could not check tattslotto rules: page unavailable/.test(l.text))).toBe(true);
  });

  it('reports a rules change from the site', async () => {
    const { http } = fakeLott({
      page: () => fixture('how-to-play-tattslotto.html').replace('from 7 to 20 numbers', 'from 7 to 18 numbers'),
    });
    const { service, log } = make(http);
    const snapshot = await service.getSnapshot('tattslotto');
    expect(snapshot.rules.system).toEqual({ min: 7, max: 18 });
    expect(log.lines.some((l) => l.level === 'warn' && /system entries: 7–20 -> 7–18/.test(l.text))).toBe(true);
  });

  it('gives raffle games a jackpot and last draw date but no draw history', async () => {
    const { http } = fakeLott();
    const { service } = make(http);
    const snapshot = await service.getSnapshot('lucky-lotteries-super');
    expect(snapshot).toMatchObject({
      source: 'thelott',
      draws: [],
      jackpot: 500_000,
      lastDrawDate: '2026-10-15',
      rulesSource: 'builtin',
    });
    expect(latestCalls(http)).toBe(1); // just the date; no history paging
    expect(http.calls.some((c) => c.url.endsWith('drawrange'))).toBe(false);
  });

  it('reports the last draw date for ordinary games too', async () => {
    const { http } = fakeLott();
    const { service } = make(http);
    expect((await service.getSnapshot('tattslotto')).lastDrawDate).toBe('2026-10-17');
  });

  it('keeps Super 66 digits in drawn order', async () => {
    const { http } = fakeLott();
    const { service } = make(http);
    const snapshot = await service.getSnapshot('super-66');
    expect(snapshot.draws[0].main).toEqual([9, 0, 0, 5, 9, 0]);
    expect(snapshot.jackpot).toBe(155_000);
  });

  it('throws when no source can produce data', async () => {
    const { http, state } = fakeLott();
    state.down = true;
    const { service } = make(http, ['thelott']);
    await expect(service.getSnapshot('tattslotto')).rejects.toThrow(/No data source produced tattslotto/);
    expect(service.status().find((s) => s.slug === 'tattslotto')?.lastError).toMatch(/No data source/);
  });

  it('survives a corrupt cache file', async () => {
    await mkdir(path.join(dir, 'cache'));
    await writeFile(path.join(dir, 'cache', 'snapshots.json'), '{broken');
    const { http } = fakeLott();
    const { service, log } = make(http);
    await service.init();
    expect(log.lines.some((l) => l.level === 'warn' && /Ignoring unreadable cache/.test(l.text))).toBe(true);
    expect((await service.getSnapshot('tattslotto')).source).toBe('thelott');
  });
});
