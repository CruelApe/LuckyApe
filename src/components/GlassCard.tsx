import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { cn } from './cn';
import { useTheme } from './ThemeRoot';

/** A translucent "frosted glass" surface. Android has no cheap blur, so it keeps the translucent fill only. */
export function GlassCard({ className, children, ...rest }: ViewProps & { className?: string }) {
  const { scheme } = useTheme();
  return (
    <View className={cn('overflow-hidden rounded-3xl border border-border bg-surface/80', className)} {...rest}>
      {Platform.OS !== 'android' && <BlurView intensity={28} tint={scheme} style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  );
}
