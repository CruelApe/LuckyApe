import type { GameSlug } from '@shared/types';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { darken, lighten } from '@/constants/colors';
import { GAME_BRAND, type BallKind } from '@/constants/gameBrand';

interface NumberBallProps {
  value: number;
  slug: GameSlug;
  kind?: BallKind;
  size?: number;
  /** Fade the ball, e.g. for numbers that are not part of a highlighted set. */
  dim?: boolean;
}

const KIND_LABEL: Record<BallKind, string> = {
  main: 'Number',
  supplementary: 'Supplementary',
  bonus: 'Powerball',
};

/** A glossy lottery ball in the game's own colours. */
export function NumberBall({ value, slug, kind = 'main', size = 40, dim = false }: NumberBallProps) {
  const { background, text } = GAME_BRAND[slug].balls[kind];
  return (
    <View
      accessible
      accessibilityLabel={`${KIND_LABEL[kind]} ${value}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: dim ? 0.4 : 1,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <LinearGradient
        colors={[lighten(background, 0.25), background, darken(background, 0.28)]}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.1,
          left: size * 0.18,
          width: size * 0.34,
          height: size * 0.2,
          borderRadius: size,
          backgroundColor: 'rgba(255,255,255,0.34)',
        }}
      />
      <Text style={{ color: text, fontSize: size * 0.42, fontWeight: '800' }} allowFontScaling={false}>
        {value}
      </Text>
    </View>
  );
}
