import { create } from 'zustand';

import type { AvailableUpdate } from '@/services/updateCheck';
import { installUpdate, type InstallPhase, type InstallerDeps } from '@/services/updateInstaller';

export interface UpdateInstallState {
  phase: InstallPhase;
  /** Why the last attempt failed, until the next one starts. */
  error: string | null;
  /** Download and install `update`. Ignored while an install is already under way, wherever it was started. */
  install(update: AvailableUpdate): Promise<void>;
  /** Delete downloaded installers (e.g. once the app is up to date). Never throws. */
  clearInstallers(): void;
}

/** Not persisted: an install in progress means nothing after the app restarts. */
export const createUpdateInstallStore = (deps: InstallerDeps) =>
  create<UpdateInstallState>()((set, get) => ({
    phase: { kind: 'idle' },
    error: null,
    install: async (update) => {
      if (get().phase.kind !== 'idle') return;
      set({ phase: { kind: 'downloading', received: 0, total: update.apkSize }, error: null });
      try {
        await installUpdate(update, deps, (phase) => set({ phase }));
      } catch (error) {
        console.error('[LuckyApe] update install failed', error);
        set({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        set({ phase: { kind: 'idle' } });
      }
    },
    clearInstallers: () => {
      try {
        deps.clearInstallers(null);
      } catch (error) {
        console.warn('[LuckyApe] could not clear downloaded installers', error);
      }
    },
  }));
