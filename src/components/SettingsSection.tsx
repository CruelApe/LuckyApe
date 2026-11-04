import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';

/**
 * A titled group on the Settings screen. Every setting lives in one of these, so adding a setting is
 * "write a component, drop it in a section" with no layout work on the screen itself.
 */
export function SettingsSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View className="mb-6 gap-3">
      <AppText accessibilityRole="header" tone="muted" className="px-1 text-xs font-bold uppercase tracking-wider">
        {title}
      </AppText>
      {children}
    </View>
  );
}
