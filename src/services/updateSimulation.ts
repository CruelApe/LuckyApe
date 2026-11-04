import { compareVersions, formatVersion, parseVersion, type UpdateResult } from './updateCheck';

/** How long the pretend check takes, so the banner arrives after the home screen is up, as a real one does. */
export const SIMULATED_CHECK_MS = 1_500;

const OFF = new Set(['', '0', 'false', 'off', 'no']);
const ON = new Set(['1', 'true', 'on', 'yes']);

/**
 * For testing the update banner without publishing a release: what `EXPO_PUBLIC_SIMULATE_UPDATE` asks the
 * update check to pretend. Pure; the caller must only use it in development builds.
 *  - unset / `0` / `off`  → null (check GitHub as normal)
 *  - `1` / `true` / `on`  → an update one patch version above the running app
 *  - a version, e.g. `2.0.0` → that version is "the latest release" (an update only if it is newer)
 *  - anything else        → null, so a typo cannot hide the real check
 *
 * The simulated update has no APK, so the banner offers "Download" (which opens the releases page) and
 * nothing is downloaded or installed.
 */
export function simulatedUpdate(flag: string | undefined, currentVersion: string, repoUrl: string): UpdateResult | null {
  const value = (flag ?? '').trim().toLowerCase();
  if (OFF.has(value)) return null;

  const current = parseVersion(currentVersion);
  if (!current) return null;

  const latest = ON.has(value) ? ([current[0], current[1], current[2] + 1] as const) : parseVersion(value);
  if (!latest) return null;

  const version = formatVersion(latest);
  if (compareVersions(latest, current) <= 0) return { status: 'current', latestVersion: version };

  const releaseUrl = `${repoUrl}/releases/latest`;
  return {
    status: 'available',
    update: {
      version,
      title: `Lucky Ape v${version} — simulated update (development only)`,
      releaseUrl,
      downloadUrl: releaseUrl,
      apkUrl: null,
      apkSize: null,
    },
  };
}
