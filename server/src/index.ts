import path from 'node:path';

import pkg from '../package.json';
import { buildApp } from './app';
import { loadConfig, loadDotEnv } from './config';
import { createHttpClient } from './http';
import { createLogger } from './log';
import { GameDataService } from './service';
import { SnapshotStore } from './store';

async function main(): Promise<void> {
  loadDotEnv();
  const config = loadConfig();
  const log = createLogger();

  const service = new GameDataService({
    config,
    http: createHttpClient(config),
    store: new SnapshotStore(path.join(config.dataDir, 'cache', 'snapshots.json')),
    log,
  });
  await service.init();

  const app = await buildApp(service, {
    version: pkg.version,
    logger: { level: process.env.LOG_LEVEL || 'warn' },
  });

  const shutdown = async (signal: string) => {
    log.info(`${signal} received, shutting down`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.port, host: config.host });
  log.info(`Lucky Ape server ${pkg.version} listening on http://${config.host}:${config.port}`);
  log.info(`Sources: ${config.sourceOrder.join(' -> ')}; history target ${config.historyDraws} draws per game`);
}

main().catch((error) => {
  console.error('Lucky Ape server failed to start:', error);
  process.exit(1);
});
