import type { Logger } from './service';

/** Minimal timestamped console logger for the data service (the HTTP layer uses Fastify's own). */
export function createLogger(sink: Pick<Console, 'log' | 'warn' | 'error'> = console): Logger {
  const line = (level: string, text: string) => `${new Date().toISOString()} ${level} ${text}`;
  return {
    info: (text) => sink.log(line('INFO ', text)),
    warn: (text) => sink.warn(line('WARN ', text)),
    error: (text) => sink.error(line('ERROR', text)),
  };
}
