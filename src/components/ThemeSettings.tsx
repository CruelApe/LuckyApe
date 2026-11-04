import { Palette } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { ThemeSelector } from './ThemeSelector';
import { useTheme } from './ThemeRoot';

/** The theme setting: Light, Dark, or follow the phone. */
export function ThemeSettings() {
  const { colors } = useTheme();
  return (
    <GlassCard className="gap-4 p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
          <Palette size={22} color={colors.primary} />
        </View>
        <View className="flex-1">
          <AppText className="text-base font-extrabold">Theme</AppText>
          <AppText tone="muted" className="text-xs leading-4">
            Choose how Lucky Ape looks.
          </AppText>
        </View>
      </View>
      <ThemeSelector />
    </GlassCard>
  );
}
