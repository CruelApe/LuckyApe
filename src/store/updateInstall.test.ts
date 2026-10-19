import { describe, expect, it, vi } from 'vitest';

import type { AvailableUpdate } from '@/services/updateCheck';
import type { InstallerDeps } from '@/services/updateInstaller';

import { createUpdateInstallStore } from './updateInstall';

const REPO = 'https://github.com/CruelApe/LuckyApe';
const update: AvailableUpdate = {
  version: '1.0.3',
  title: 'Lucky Ape v1.0.3',
  releaseUrl: `${REPO}/releases/tag/v1.0.3`,
  downloadUrl: `${REPO}/releases/download/v1.0.3/a.apk`,
  apkUrl: `${REPO}/releases/download/v1.0.3/a.apk`,
  apkSize: 100,
};

function deps(overrides: Partial<InstallerDeps> = {}): InstallerDeps {
  const files = new Map<string, number>();
  return {
    apkPath: () => 'file:///cache/updates/a.apk',
    fileSize: (path) => files.get(path) ?? null,
    remove: (path) => void files.delete(path),
    clearInstallers: () => undefined,
    download: async (_url, path) => void files.set(path, 100),
    openInstaller: async () => undefined,
    ...overrides,
  };
}

describe('update install store', () => {
  it('starts idle with nothing to report', () => {
    expect(createUpdateInstallStore(deps()).getState()).toMatchObject({ phase: { kind: 'idle' }, error: null });
  });

  it('shows the download, then the installer, then goes back to idle', async () => {
    let release!: () => void;
    const store = createUpdateInstallStore(
      deps({ openInstaller: () => new Promise<void>((resolve) => (release = resolve)) }),
    );
    const seen: string[] = [];
    store.subscribe((state) => seen.push(state.phase.kind));

    const running = store.getState().install(update);
    await vi.waitFor(() => expect(store.getState().phase.kind).toBe('installing'));
    release();
    await running;

    expect(seen[0]).toBe('downloading');
    expect(seen).toContain('installing');
    expect(store.getState()).toMatchObject({ phase: { kind: 'idle' }, error: null });
  });

  it('ignores a second request while one is under way, so the banner and About cannot both start a download', async () => {
    const download = vi.fn(async () => new Promise<void>(() => undefined));
    const store = createUpdateInstallStore(deps({ download }));
    void store.getState().install(update);
    await store.getState().install(update);
    expect(download).toHaveBeenCalledOnce();
    expect(store.getState().phase.kind).toBe('downloading');
  });

  it('keeps the reason a failed install gave, logs it, and lets the user try again', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = createUpdateInstallStore(
      deps({
        download: async () => {
          throw new Error('Network request failed');
        },
      }),
    );
    await store.getState().install(update);
    expect(store.getState()).toMatchObject({
      phase: { kind: 'idle' },
      error: 'The download failed: Network request failed',
    });
    expect(log).toHaveBeenCalledWith('[LuckyApe] update install failed', expect.any(Error));

    // A new attempt clears the old message.
    const retry = createUpdateInstallStore(deps());
    retry.setState({ error: 'The download failed: Network request failed' });
    await retry.getState().install(update);
    expect(retry.getState().error).toBeNull();
    log.mockRestore();
  });

  it('clears downloaded installers, and survives a failure to do so', () => {
    const clearInstallers = vi.fn();
    createUpdateInstallStore(deps({ clearInstallers })).getState().clearInstallers();
    expect(clearInstallers).toHaveBeenCalledWith(null);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = createUpdateInstallStore(
      deps({
        clearInstallers: () => {
          throw new Error('denied');
        },
      }),
    );
    expect(() => failing.getState().clearInstallers()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
