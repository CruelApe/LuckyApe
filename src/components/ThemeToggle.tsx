import { Moon, Sun } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from './ThemeRoot';

/** ☀️ / 🌙 switch. The thumb slides to whichever mode is active. */
export function ThemeToggle() {
  const { scheme, toggle, colors } = useTheme();
  const dark = scheme === 'dark';
  const position = useSharedValue(dark ? 1 : 0);

  useEffect(() => {
    position.set(withTiming(dark ? 1 : 0, { duration: 220 }));
  }, [dark, position]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() * 36 }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Dark mode"
      accessibilityState={{ checked: dark }}
      onPress={toggle}
      hitSlop={6}
      className="h-11 w-20 flex-row items-center rounded-full border border-border bg-surface/80 p-1"
    >
      {/* Inline style, not className: NativeWind does not style Reanimated views reliably. */}
      <Animated.View
        style={[
          { position: 'absolute', left: 4, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary },
          thumb,
        ]}
      />
      <View className="h-9 w-9 items-center justify-center">
        <Sun size={18} color={dark ? colors['fg-muted'] : colors['on-primary']} />
      </View>
      <View className="h-9 w-9 items-center justify-center">
        <Moon size={18} color={dark ? colors['on-primary'] : colors['fg-muted']} />
      </View>
    </Pressable>
  );
}
