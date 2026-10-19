import { Directory, File, Paths } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';

import type { InstallerDeps } from './updateInstaller';

const APK_MIME_TYPE = 'application/vnd.android.package-archive';
/** `Intent.FLAG_GRANT_READ_URI_PERMISSION`: lets the installer read the APK through its content:// address. */
const FLAG_GRANT_READ_URI_PERMISSION = 1;
/** Give up on a download that has received nothing for this long. */
const STALL_TIMEOUT_MS = 60_000;

/** Inside the app's cache, which Expo's file provider can already share with the installer. */
const installersDir = () => new Directory(Paths.cache, 'updates');

/** The phone-specific half of installing an update: files in the app's cache, and Android's package installer. */
export const androidInstallerDeps: InstallerDeps = {
  apkPath(version) {
    const dir = installersDir();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return new File(dir, `lucky-ape-${version}.apk`).uri;
  },

  fileSize(path) {
    const file = new File(path);
    return file.exists ? file.size : null;
  },

  remove(path) {
    const file = new File(path);
    if (file.exists) file.delete();
  },

  clearInstallers(keep) {
    const dir = installersDir();
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      if (entry instanceof File && entry.uri !== keep) entry.delete();
    }
  },

  async download(url, path, onProgress) {
    const controller = new AbortController();
    let stalled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        stalled = true;
        controller.abort();
      }, STALL_TIMEOUT_MS);
    };

    arm();
    try {
      await File.downloadFileAsync(url, new File(path), {
        idempotent: true,
        signal: controller.signal,
        onProgress: ({ bytesWritten, totalBytes }) => {
          arm();
          onProgress(bytesWritten, totalBytes > 0 ? totalBytes : null);
        },
      });
    } catch (error) {
      if (stalled) throw new Error(`no data arrived for ${STALL_TIMEOUT_MS / 1000} seconds`, { cause: error });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  },

  async openInstaller(path) {
    await startActivityAsync('android.intent.action.VIEW', {
      data: new File(path).contentUri,
      type: APK_MIME_TYPE,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
  },
};
