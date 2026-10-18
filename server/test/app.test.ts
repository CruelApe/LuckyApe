import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GAME_SLUGS, type GameSnapshot, type GamesResponse } from '../../shared/types';
import { buildApp } from '../src/app';
import { UpstreamError } from '../src/http';
import { GameDataService } from '../src/service';
import { SnapshotStore } from '../src/store';
import { captureLogger, fakeHttp, fixture, fixtureJson, testConfig } from './helpers';

describe('HTTP API', () => {
  let dir: string;
  let app: FastifyInstance;
  let down = false;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'luckyape-app-'));
    down = false;
    const http = fakeHttp({
      get: (url) => {
        if (down) throw new UpstreamError('network down', url);
        return fixture(`how-to-play-${url.split('/').at(-2)}.html`);
      },
      post: (url, body) => {
        if (down) throw new UpstreamError('network down', url);
        if (url.endsWith('latestresults')) return fixtureJson(`latest-${body.OptionalProductFilter[0]}.json`);
        if (url.endsWith('drawrange')) return { Success: true, Draws: [] };
        return fixtureJson('opendraws.json');
      },
    });
    const service = new GameDataService({
      config: testConfig({ dataDir: dir, historyDraws: 10, sourceOrder: ['thelott'] }),
      http,
      store: new SnapshotStore(path.join(dir, 'snapshots.json')),
      log: captureLogger(),
    });
    app = await buildApp(service, { version: '9.9.9' });
  });

  afterEach(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('GET /api/health', async () => {
    const response = await app.inject('/api/health');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, version: '9.9.9' });
  });

  it('GET /api/games returns every game in the documented order, cacheable for a minute', async () => {
    const response = await app.inject('/api/games');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    const body = response.json<GamesResponse>();
    expect(body.games.map((g) => g.slug)).toEqual([...GAME_SLUGS]);
    expect(Date.parse(body.generatedAt)).not.toBeNaN();
  });

  it('GET /api/games/:slug returns one snapshot', async () => {
    const response = await app.inject('/api/games/powerball');
    const body = response.json<GameSnapshot>();
    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({ slug: 'powerball', source: 'thelott', jackpot: 10_000_000 });
    expect(body.draws[0]).toMatchObject({ powerball: 16, supplementary: [] });
  });

  it('404s an unknown game', async () => {
    const response = await app.inject('/api/games/keno');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Not Found', message: 'Unknown game "keno"' });
  });

  it('answers 502 with a JSON message when no data can be produced', async () => {
    down = true;
    const response = await app.inject('/api/games/tattslotto');
    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({ error: 'Bad Gateway' });
    expect(response.json().message).toMatch(/No data source produced tattslotto/);
  });

  it('GET /api/status reports per-game provenance', async () => {
    await app.inject('/api/games/oz-lotto');
    const { games } = (await app.inject('/api/status')).json<{ games: { slug: string; source: string | null; draws: number }[] }>();
    expect(games).toHaveLength(7);
    expect(games.find((g) => g.slug === 'oz-lotto')).toMatchObject({ source: 'thelott', draws: 3 });
    expect(games.find((g) => g.slug === 'tattslotto')).toMatchObject({ source: null, draws: 0 });
  });
});
