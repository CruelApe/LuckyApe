import type { AvailableUpdate } from './updateCheck';

export class UpdateInstallError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UpdateInstallError';
  }
}

export type InstallPhase =
  | { kind: 'idle' }
  | { kind: 'downloading'; received: number; total: number | null }
  | { kind: 'installing' };

/** The device-specific parts, injected so the flow can be tested without a phone. */
export interface InstallerDeps {
  /** Where the APK for this version is kept (inside the app's own cache). */
  apkPath(version: string): string;
  /** Size in bytes of the file at `path`, or null if there is no such file. */
  fileSize(path: string): number | null;
  /** Delete the file at `path`; a no-op if there is none. */
  remove(path: string): void;
  /** Delete every downloaded installer except `keep` (none, when `keep` is null). */
  clearInstallers(keep: string | null): void;
  download(url: string, path: string, onProgress: (received: number, total: number | null) => void): Promise<void>;
  /** Hand the file to Android's package installer. Resolves when the user is back in the app. */
  openInstaller(path: string): Promise<void>;
}

/** With no known total, report progress about this often rather than on every chunk. */
const UNKNOWN_TOTAL_STEP_BYTES = 512 * 1024;

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Downloads the release's APK and opens Android's installer for it. The user still taps Install:
 * Android never lets an ordinary app install silently, and it only accepts an update signed with
 * the same key as the installed app, so a swapped file cannot replace Lucky Ape.
 *
 * A copy already downloaded for this version (the user cancelled the installer earlier) is reused
 * if it is the size the release says it should be. Every failure is an `UpdateInstallError`.
 */
export async function installUpdate(
  update: AvailableUpdate,
  deps: InstallerDeps,
  onPhase: (phase: InstallPhase) => void,
): Promise<void> {
  if (!update.apkUrl) throw new UpdateInstallError('This release has no Android app to install');

  const path = deps.apkPath(update.version);
  const sizeOk = (size: number | null) =>
    size !== null && size > 0 && (update.apkSize === null || size === update.apkSize);

  try {
    deps.clearInstallers(path);
  } catch (cause) {
    // Housekeeping only: a stale file is harmless, so it must not stop the update.
    console.warn('[LuckyApe] could not clear old installers', cause);
  }

  if (!sizeOk(deps.fileSize(path))) {
    deps.remove(path);
    onPhase({ kind: 'downloading', received: 0, total: update.apkSize });

    let lastPercent = -1;
    let lastReported = 0;
    try {
      await deps.download(update.apkUrl, path, (received, total) => {
        const known = total ?? update.apkSize;
        if (known) {
          const percent = Math.floor((received / known) * 100);
          if (percent === lastPercent) return;
          lastPercent = percent;
        } else {
          if (received - lastReported < UNKNOWN_TOTAL_STEP_BYTES) return;
          lastReported = received;
        }
        onPhase({ kind: 'downloading', received, total: known ?? null });
      });
    } catch (cause) {
      deps.remove(path);
      throw new UpdateInstallError(`The download failed: ${reason(cause)}`, { cause });
    }

    const size = deps.fileSize(path);
    if (!sizeOk(size)) {
      deps.remove(path);
      const expected = update.apkSize === null ? '' : ` of ${update.apkSize}`;
      throw new UpdateInstallError(`The download was incomplete (${size ?? 0}${expected} bytes). Please try again.`);
    }
  }

  onPhase({ kind: 'installing' });
  try {
    await deps.openInstaller(path);
  } catch (cause) {
    throw new UpdateInstallError(`Could not open the installer: ${reason(cause)}`, { cause });
  }
}

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export interface InstallProgressView {
  label: string;
  /** 0–100, or null when the size is not known. */
  percent: number | null;
}

/** What to say, and how full to draw the bar, for the install state; null when nothing is happening. */
export function describeInstallPhase(phase: InstallPhase): InstallProgressView | null {
  switch (phase.kind) {
    case 'idle':
      return null;
    case 'installing':
      return { label: 'Opening the installer…', percent: 100 };
    case 'downloading': {
      if (!phase.total) return { label: `Downloading… ${megabytes(phase.received)}`, percent: null };
      const percent = Math.min(100, Math.floor((phase.received / phase.total) * 100));
      return {
        label: `Downloading… ${percent}% (${megabytes(phase.received)} of ${megabytes(phase.total)})`,
        percent,
      };
    }
  }
}
