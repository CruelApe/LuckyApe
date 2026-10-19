import { describe, expect, it, vi } from 'vitest';

import type { AvailableUpdate } from './updateCheck';
import {
  UpdateInstallError,
  describeInstallPhase,
  installUpdate,
  type InstallPhase,
  type InstallerDeps,
} from './updateInstaller';

const REPO = 'https://github.com/CruelApe/LuckyApe';
const SIZE = 10_000;
const PATH = 'file:///cache/updates/lucky-ape-1.0.3.apk';

const update = (overrides: Partial<AvailableUpdate> = {}): AvailableUpdate => ({
  version: '1.0.3',
  title: 'Lucky Ape v1.0.3',
  releaseUrl: `${REPO}/releases/tag/v1.0.3`,
  downloadUrl: `${REPO}/releases/download/v1.0.3/lucky-ape-1.0.3.apk`,
  apkUrl: `${REPO}/releases/download/v1.0.3/lucky-ape-1.0.3.apk`,
  apkSize: SIZE,
  ...overrides,
});

/** A fake phone: files live in a map, and a "download" writes `downloaded` bytes. */
function harness(options: { existing?: number; downloaded?: number; chunks?: number[]; total?: number | null } = {}) {
  const files = new Map<string, number>();
  if (options.existing !== undefined) files.set(PATH, options.existing);
  const events: string[] = [];
  const phases: InstallPhase[] = [];

  const deps: InstallerDeps = {
    apkPath: () => PATH,
    fileSize: (path) => files.get(path) ?? null,
    remove: vi.fn((path: string) => {
      events.push('remove');
      files.delete(path);
    }),
    clearInstallers: vi.fn((keep: string | null) => {
      events.push(`clear:${keep}`);
    }),
    download: vi.fn(async (_url, path, onProgress) => {
      events.push('download');
      for (const received of options.chunks ?? [SIZE]) onProgress(received, options.total === undefined ? SIZE : options.total);
      files.set(path, options.downloaded ?? SIZE);
    }),
    openInstaller: vi.fn(async () => {
      events.push('install');
    }),
  };
  const run = (u: AvailableUpdate = update()) => installUpdate(u, deps, (phase) => phases.push(phase));
  return { deps, files, events, phases, run };
}

describe('installUpdate', () => {
  it('downloads the APK, then opens the installer for it', async () => {
    const { deps, events, phases, run } = harness();
    await run();
    expect(deps.download).toHaveBeenCalledWith(update().apkUrl, PATH, expect.any(Function));
    expect(deps.openInstaller).toHaveBeenCalledWith(PATH);
    expect(events).toEqual([`clear:${PATH}`, 'remove', 'download', 'install']);
    expect(phases.at(0)).toEqual({ kind: 'downloading', received: 0, total: SIZE });
    expect(phases.at(-1)).toEqual({ kind: 'installing' });
  });

  it('keeps any other downloaded version out of the way first', async () => {
    const { deps, run } = harness();
    await run();
    expect(deps.clearInstallers).toHaveBeenCalledWith(PATH);
  });

  it('reuses a finished download instead of fetching it again', async () => {
    const { deps, events, run } = harness({ existing: SIZE });
    await run();
    expect(deps.download).not.toHaveBeenCalled();
    expect(events).toEqual([`clear:${PATH}`, 'install']);
  });

  it('replaces a partial or wrong-sized file', async () => {
    const { deps, run } = harness({ existing: SIZE - 1 });
    await run();
    expect(deps.download).toHaveBeenCalledOnce();
  });

  it('reuses a file when the release does not say how big the APK is', async () => {
    const { deps, run } = harness({ existing: 1234 });
    await run(update({ apkSize: null }));
    expect(deps.download).not.toHaveBeenCalled();
  });

  it('refuses a release with no APK, without touching the device', async () => {
    const { deps, run } = harness();
    await expect(run(update({ apkUrl: null }))).rejects.toThrow(UpdateInstallError);
    expect(deps.download).not.toHaveBeenCalled();
    expect(deps.openInstaller).not.toHaveBeenCalled();
  });

  describe('when something goes wrong', () => {
    it('reports a failed download, deletes the partial file and never opens the installer', async () => {
      const { deps, files, run } = harness();
      vi.mocked(deps.download).mockImplementation(async (_url, path) => {
        files.set(path, 400);
        throw new Error('Network request failed');
      });
      const error = await run().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UpdateInstallError);
      expect((error as Error).message).toBe('The download failed: Network request failed');
      expect((error as Error).cause).toBeInstanceOf(Error);
      expect(files.has(PATH)).toBe(false);
      expect(deps.openInstaller).not.toHaveBeenCalled();
    });

    it('rejects a truncated download, deletes it and never opens the installer', async () => {
      const { deps, files, run } = harness({ downloaded: 4_000 });
      await expect(run()).rejects.toThrow('The download was incomplete (4000 of 10000 bytes). Please try again.');
      expect(files.has(PATH)).toBe(false);
      expect(deps.openInstaller).not.toHaveBeenCalled();
    });

    it('rejects an empty download even when the release has no size to compare with', async () => {
      const { files, run } = harness({ downloaded: 0 });
      await expect(run(update({ apkSize: null }))).rejects.toThrow(/incomplete \(0 bytes\)/);
      expect(files.has(PATH)).toBe(false);
    });

    it('says so when the installer cannot be opened, and keeps the download for a retry', async () => {
      const { deps, files, run } = harness();
      vi.mocked(deps.openInstaller).mockRejectedValue(new Error('No Activity found to handle Intent'));
      await expect(run()).rejects.toThrow('Could not open the installer: No Activity found to handle Intent');
      expect(files.get(PATH)).toBe(SIZE);
    });

    it('carries on if tidying old installers fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { deps, run } = harness();
      vi.mocked(deps.clearInstallers).mockImplementation(() => {
        throw new Error('permission denied');
      });
      await run();
      expect(deps.openInstaller).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith('[LuckyApe] could not clear old installers', expect.any(Error));
      warn.mockRestore();
    });
  });

  describe('progress', () => {
    it('reports each whole percent once, not every chunk', async () => {
      const chunks = [10, 20, 30, 40, 50, 60, 100, 5_000, 5_050, 10_000];
      const { phases, run } = harness({ chunks });
      await run();
      // Drop the initial 0-byte phase; what follows is one report per distinct percent: 0, 1, 50, 100.
      const percents = phases
        .filter((p) => p.kind === 'downloading')
        .slice(1)
        .map((p) => Math.floor((p.received / SIZE) * 100));
      expect(percents).toEqual([0, 1, 50, 100]);
    });

    it('uses the size the server reports when the release gave none', async () => {
      const { phases, run } = harness({ chunks: [5_000, 10_000], total: 10_000 });
      await run(update({ apkSize: null }));
      expect(phases).toContainEqual({ kind: 'downloading', received: 5_000, total: 10_000 });
    });

    it('steps by half a megabyte when no total is known anywhere', async () => {
      const half = 512 * 1024;
      const { phases, run } = harness({ chunks: [1_000, half, half + 1_000, half * 2], total: null, downloaded: 1 });
      await run(update({ apkSize: null }));
      const received = phases.flatMap((p) => (p.kind === 'downloading' && p.received > 0 ? [p.received] : []));
      expect(received).toEqual([half, half * 2]);
    });
  });
});

describe('describeInstallPhase', () => {
  it('says nothing when idle', () => {
    expect(describeInstallPhase({ kind: 'idle' })).toBeNull();
  });

  it('shows percent and megabytes while downloading', () => {
    expect(describeInstallPhase({ kind: 'downloading', received: 15 * 1024 * 1024, total: 30 * 1024 * 1024 })).toEqual({
      label: 'Downloading… 50% (15.0 MB of 30.0 MB)',
      percent: 50,
    });
  });

  it('shows no bar when the size is unknown', () => {
    expect(describeInstallPhase({ kind: 'downloading', received: 2 * 1024 * 1024, total: null })).toEqual({
      label: 'Downloading… 2.0 MB',
      percent: null,
    });
  });

  it('never goes past 100%', () => {
    expect(describeInstallPhase({ kind: 'downloading', received: 120, total: 100 })?.percent).toBe(100);
  });

  it('announces the hand-over to Android', () => {
    expect(describeInstallPhase({ kind: 'installing' })).toEqual({ label: 'Opening the installer…', percent: 100 });
  });
});
