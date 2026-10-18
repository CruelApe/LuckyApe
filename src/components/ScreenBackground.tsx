import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { withAlpha } from '@/constants/theme';

import { useTheme } from './ThemeRoot';

/** Soft colour glows behind the content — what the glass cards sit on, and the reason the blur is visible. */
export function ScreenBackground() {
  const { scheme } = useTheme();
  const strength = scheme === 'dark' ? 0.22 : 0.16;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[withAlpha('#FBBF24', strength), 'transparent']}
        style={{ position: 'absolute', top: -140, right: -120, width: 360, height: 360, borderRadius: 180 }}
      />
      <LinearGradient
        colors={[withAlpha('#8B5CF6', strength), 'transparent']}
        style={{ position: 'absolute', bottom: -160, left: -140, width: 400, height: 400, borderRadius: 200 }}
      />
    </View>
  );
}
