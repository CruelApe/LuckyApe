import { existsSync } from 'node:fs';
import path from 'node:path';

import { DEFAULT_THELOTT_API_BASE, DEFAULT_THELOTT_COMPANY } from '../../shared/thelott';

export type SourceName = 'import' | 'thelott' | 'sample';

export interface Config {
  port: number;
  host: string;
  /** How long a snapshot is served before a background refresh is started. */
  cacheTtlMs: number;
  /** How many draws of history to collect per pick-style game. */
  historyDraws: number;
  thelottApiBase: string;
  thelottSiteBase: string;
  /** The Lott company filter; results are national, this only selects the dividend jurisdiction. */
  thelottCompany: string;
  /** Pause between upstream requests, to stay polite. */
  requestDelayMs: number;
  requestTimeoutMs: number;
  userAgent: string;
  /** Sources tried in order; the first one that yields draws wins. */
  sourceOrder: SourceName[];
  dataDir: string;
}

const SOURCE_NAMES: readonly SourceName[] = ['import', 'thelott', 'sample'];

function int(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} must be an integer between ${min} and ${max} (got "${raw}")`);
  }
  return value;
}

function parseSourceOrder(raw: string | undefined): SourceName[] {
  if (!raw) return ['import', 'thelott', 'sample'];
  const names = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const unknown = names.filter((n) => !(SOURCE_NAMES as readonly string[]).includes(n));
  if (unknown.length > 0) {
    throw new Error(`SOURCE_ORDER has unknown source(s): ${unknown.join(', ')}. Use: ${SOURCE_NAMES.join(', ')}`);
  }
  return names as SourceName[];
}

/** Load `server/.env` (if present) into process.env without overriding real environment variables. */
export function loadDotEnv(file = path.resolve(__dirname, '..', '.env')): void {
  if (existsSync(file) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(file);
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: int(env, 'PORT', 8787, 1, 65535),
    host: env.HOST || '0.0.0.0',
    cacheTtlMs: int(env, 'CACHE_TTL_MINUTES', 360, 1, 7 * 24 * 60) * 60_000,
    historyDraws: int(env, 'HISTORY_DRAWS', 100, 10, 300),
    thelottApiBase: (env.THELOTT_API_BASE || DEFAULT_THELOTT_API_BASE).replace(/\/+$/, ''),
    thelottSiteBase: (env.THELOTT_SITE_BASE || 'https://www.thelott.com').replace(/\/+$/, ''),
    thelottCompany: env.THELOTT_COMPANY || DEFAULT_THELOTT_COMPANY,
    requestDelayMs: int(env, 'REQUEST_DELAY_MS', 600, 0, 10_000),
    requestTimeoutMs: int(env, 'REQUEST_TIMEOUT_MS', 20_000, 1_000, 120_000),
    userAgent:
      env.USER_AGENT ||
      'LuckyApe/1.0 (+https://github.com/CruelApe/LuckyApe; independent statistical tool)',
    sourceOrder: parseSourceOrder(env.SOURCE_ORDER),
    dataDir: path.resolve(env.DATA_DIR || path.join(__dirname, '..', 'data')),
  };
}
