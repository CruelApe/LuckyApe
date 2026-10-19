import { ActivityIndicator, View } from 'react-native';

import type { InstallProgressView } from '@/services/updateInstaller';

import { AppText } from './AppText';
import { ProgressBar } from './ProgressBar';
import { useTheme } from './ThemeRoot';

/** The update download's progress bar and a line saying what it is doing. */
export function UpdateProgress({ progress }: { progress: InstallProgressView }) {
  const { colors } = useTheme();
  return (
    <View className="gap-2">
      {progress.percent === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <ProgressBar value={progress.percent} label="Update download progress" />
      )}
      <AppText tone="muted" className="text-center text-xs">
        {progress.label}
      </AppText>
    </View>
  );
}
