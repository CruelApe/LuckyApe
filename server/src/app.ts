import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { isGameSlug } from '../../shared/games';
import { GAME_SLUGS, type GamesResponse, type HealthResponse } from '../../shared/types';
import type { GameDataService } from './service';

export interface AppOptions {
  version: string;
  logger?: FastifyServerOptions['logger'];
}

/** Build the HTTP API. Kept separate from `listen` so tests can drive it with `inject`. */
export async function buildApp(service: GameDataService, options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  await app.register(cors, { origin: true });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 502;
    reply.status(status).send({ error: status === 502 ? 'Bad Gateway' : error.name, message: error.message });
  });

  app.get('/api/health', async (): Promise<HealthResponse> => ({
    ok: true,
    version: options.version,
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.get('/api/status', async () => ({ games: service.status() }));

  app.get('/api/games', async (_request, reply): Promise<GamesResponse> => {
    reply.header('Cache-Control', 'public, max-age=60');
    const games = [];
    // Sequential on purpose: each cold game makes a few upstream calls and the client paces them anyway.
    for (const slug of GAME_SLUGS) games.push(await service.getSnapshot(slug));
    return { generatedAt: new Date().toISOString(), games };
  });

  app.get<{ Params: { slug: string } }>('/api/games/:slug', async (request, reply) => {
    const { slug } = request.params;
    if (!isGameSlug(slug)) {
      return reply.status(404).send({ error: 'Not Found', message: `Unknown game "${slug}"` });
    }
    reply.header('Cache-Control', 'public, max-age=60');
    return service.getSnapshot(slug);
  });

  return app;
}
