import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { GameSlug, GameSnapshot } from '../../shared/types';

export interface StoreState {
  snapshots: Partial<Record<GameSlug, GameSnapshot>>;
  /** When each game's how-to-play page was last checked (ISO), so we do not refetch it every refresh. */
  rulesCheckedAt: Partial<Record<GameSlug, string>>;
}

interface StoreFile extends StoreState {
  version: 1;
}

export const emptyState = (): StoreState => ({ snapshots: {}, rulesCheckedAt: {} });

/** JSON-file persistence so a restart does not need to re-scrape. Writes are atomic and serialised. */
export class SnapshotStore {
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {}

  /**
   * Returns the saved state, or an empty one if there is none yet.
   * A corrupt file is reported to `onCorrupt` and ignored rather than crashing the service.
   */
  async load(onCorrupt: (error: Error) => void = () => undefined): Promise<StoreState> {
    let text: string;
    try {
      text = await readFile(this.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
      throw error;
    }
    try {
      const parsed = JSON.parse(text) as Partial<StoreFile>;
      if (parsed.version !== 1 || typeof parsed.snapshots !== 'object' || parsed.snapshots === null) {
        throw new Error('unrecognised cache format');
      }
      return { snapshots: parsed.snapshots, rulesCheckedAt: parsed.rulesCheckedAt ?? {} };
    } catch (cause) {
      onCorrupt(new Error(`Ignoring unreadable cache ${this.file}: ${(cause as Error).message}`, { cause }));
      return emptyState();
    }
  }

  save(state: StoreState): Promise<void> {
    const payload: StoreFile = { version: 1, ...state };
    const run = async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(payload), 'utf8');
      await rename(temp, this.file);
    };
    this.writes = this.writes.then(run, run);
    return this.writes;
  }
}
