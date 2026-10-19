import { CircleArrowDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import { canInstallInApp, useUpdateInstall, useUpdateInstallStore } from '@/hooks/useUpdateInstall';

import { AppText } from './AppText';
import { useTheme } from './ThemeRoot';
import { UpdateProgress } from './UpdateProgress';

/**
 * Shown on the home screen when a newer release exists, found by the check made as the app opens.
 * Says nothing when up to date or when the check could not be made (that is logged, and About can retry).
 * "Later" hides it until the app is next opened.
 */
export function UpdateBanner() {
  const { colors } = useTheme();
  const { result } = useUpdateCheck();
  const { busy, progress, error, start } = useUpdateInstall();
  const clearInstallers = useUpdateInstallStore((s) => s.clearInstallers);
  const [dismissed, setDismissed] = useState(false);

  // Once the app is the newest release, the installer it was updated from is just taking up space.
  const status = result?.status;
  useEffect(() => {
    if (status === 'current' && Platform.OS === 'android') clearInstallers();
  }, [status, clearInstallers]);

  if ((dismissed && !busy) || result?.status !== 'available') return null;
  const { update } = result;

  return (
    <View
      accessibilityLiveRegion="polite"
      className="mb-3 gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-3.5 py-3"
    >
      <View className="flex-row items-start gap-3">
        <CircleArrowDown size={20} color={colors.primary} style={{ marginTop: 1 }} />
        <View className="flex-1">
          <AppText tone="primary" className="text-sm font-bold">
            Update available · v{update.version}
          </AppText>
          <AppText tone="muted" className="text-xs leading-4" numberOfLines={2}>
            {update.title}
          </AppText>
        </View>
      </View>

      {error && (
        <AppText tone="danger" className="text-xs leading-4">
          {error}
        </AppText>
      )}

      {progress ? (
        <UpdateProgress progress={progress} />
      ) : (
        <View className="flex-row justify-end gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hide the update notice for now"
            onPress={() => setDismissed(true)}
            className="min-h-10 items-center justify-center rounded-full px-4 active:opacity-60"
          >
            <AppText tone="muted" className="text-sm font-semibold">
              Later
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${canInstallInApp(update) ? 'Install' : 'Download'} Lucky Ape version ${update.version}`}
            onPress={() => void start(update)}
            className="min-h-10 items-center justify-center rounded-full bg-primary px-5 active:opacity-70"
          >
            <AppText tone="onPrimary" className="text-sm font-bold">
              {canInstallInApp(update) ? (error ? 'Try again' : 'Update now') : 'Download'}
            </AppText>
          </Pressable>
        </View>
      )}
    </View>
  );
}
