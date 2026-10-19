import { Platform } from 'react-native';

import { androidInstallerDeps } from '@/services/androidInstaller';
import { openLink } from '@/services/links';
import type { AvailableUpdate } from '@/services/updateCheck';
import { describeInstallPhase } from '@/services/updateInstaller';
import { createUpdateInstallStore } from '@/store/updateInstall';

/** One install at a time, shared by every screen that offers the update. */
export const useUpdateInstallStore = createUpdateInstallStore(androidInstallerDeps);

/** An Android phone can download the release's APK and hand it to the installer itself; anything else opens the browser. */
export const canInstallInApp = (update: AvailableUpdate) => Platform.OS === 'android' && update.apkUrl !== null;

/** Installing the update from inside the app, and what to show while it happens. */
export function useUpdateInstall() {
  const phase = useUpdateInstallStore((s) => s.phase);
  const error = useUpdateInstallStore((s) => s.error);
  const install = useUpdateInstallStore((s) => s.install);

  return {
    busy: phase.kind !== 'idle',
    progress: describeInstallPhase(phase),
    error,
    start: (update: AvailableUpdate) =>
      canInstallInApp(update) ? install(update) : openLink(update.downloadUrl, 'Could not open the download'),
  };
}
