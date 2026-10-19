import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  /** Spoken by screen readers. */
  label?: string;
}

/** Animated determinate progress bar. */
export function ProgressBar({ value, label = 'Loading progress' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(clamped / 100, { duration: 380, easing: Easing.out(Easing.cubic) }));
  }, [clamped, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      className="h-3 w-full overflow-hidden rounded-full bg-surface-muted"
    >
      <Animated.View style={[{ height: '100%', borderRadius: 999, overflow: 'hidden' }, fill]}>
        <LinearGradient colors={['#FBBF24', '#F59E0B', '#FB923C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}
