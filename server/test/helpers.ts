import { readFileSync } from 'node:fs';
import path from 'node:path';

import { loadConfig, type Config } from '../src/config';
import type { HttpClient } from '../src/http';
import type { Logger } from '../src/service';

export const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
export const fixtureJson = <T = any>(name: string): T => JSON.parse(fixture(name)) as T;

export interface RecordedCall {
  method: 'GET' | 'POST';
  url: string;
  body?: any;
}

export interface FakeHttp extends HttpClient {
  calls: RecordedCall[];
}

/** An HttpClient that answers from the given handlers and records every call. */
export function fakeHttp(handlers: {
  get?: (url: string) => string;
  post?: (url: string, body: any) => unknown;
}): FakeHttp {
  const calls: RecordedCall[] = [];
  return {
    calls,
    async getText(url) {
      calls.push({ method: 'GET', url });
      if (!handlers.get) throw new Error(`unexpected GET ${url}`);
      return handlers.get(url);
    },
    async postJson<T>(url: string, body: unknown) {
      calls.push({ method: 'POST', url, body });
      if (!handlers.post) throw new Error(`unexpected POST ${url}`);
      return handlers.post(url, body) as T;
    },
  };
}

export const testConfig = (overrides: Partial<Config> = {}): Config => ({
  ...loadConfig({}),
  requestDelayMs: 0,
  ...overrides,
});

export interface CapturedLogger extends Logger {
  lines: { level: 'info' | 'warn' | 'error'; text: string }[];
}

export function captureLogger(): CapturedLogger {
  const lines: CapturedLogger['lines'] = [];
  return {
    lines,
    info: (text) => lines.push({ level: 'info', text }),
    warn: (text) => lines.push({ level: 'warn', text }),
    error: (text) => lines.push({ level: 'error', text }),
  };
}

/** The Lott's standard "this is not allowed" envelope, used to simulate API-level failures. */
export const apiFailure = (message: string) => ({
  Draws: null,
  DrawResults: null,
  Success: false,
  ErrorInfo: { SystemId: 200, ErrorNo: 1, DisplayMessage: message },
});
