/**
 * Canary: runs the real pipeline against thelott.com and reports whether the site still matches
 * what the scraper expects. Exits 1 on any failure or when the site's rules differ from the
 * built-in ones. Uses a throw-away cache directory, so it never touches your real cache.
 *
 *   npm --prefix server run check:live
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { GAME_SLUGS } from '../../shared/types';
import { loadConfig } from '../src/config';
import { createHttpClient } from '../src/http';
import { GameDataService, type Logger } from '../src/service';
import { SnapshotStore } from '../src/store';

async function main(): Promise<number> {
  const dir = await mkdtemp(path.join(tmpdir(), 'luckyape-live-'));
  const warnings: string[] = [];
  const log: Logger = {
    info: () => undefined,
    warn: (m) => warnings.push(m),
    error: (m) => warnings.push(m),
  };
  const config = { ...loadConfig(), dataDir: dir, historyDraws: 30, sourceOrder: ['thelott' as const] };
  const service = new GameDataService({
    config,
    http: createHttpClient(config),
    store: new SnapshotStore(path.join(dir, 'snapshots.json')),
    log,
  });

  let failures = 0;
  try {
    for (const slug of GAME_SLUGS) {
      try {
        const s = await service.getSnapshot(slug);
        const newest = s.draws[0];
        console.log(
          `OK   ${slug.padEnd(22)} ${String(s.draws.length).padStart(3)} draws  rules=${s.rulesSource.padEnd(7)} ` +
            `jackpot=${s.jackpot ?? '-'}  newest=${newest ? `#${newest.drawNumber} ${newest.date}` : '-'}`,
        );
      } catch (error) {
        failures += 1;
        console.log(`FAIL ${slug.padEnd(22)} ${(error as Error).message}`);
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const differences = warnings.filter((w) => /differ from built-in|failed|Could not/i.test(w));
  for (const w of differences) console.log(`WARN ${w}`);
  console.log(failures + differences.length === 0 ? '\nThe Lott still matches the scraper.' : '\nCheck the lines above.');
  return failures + differences.length === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
