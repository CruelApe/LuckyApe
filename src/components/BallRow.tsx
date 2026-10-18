import type { GameSlug } from '@shared/types';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { AppText } from './AppText';
import { NumberBall } from './NumberBall';

interface BallRowProps {
  slug: GameSlug;
  main: number[];
  supplementary?: number[];
  powerball?: number | null;
  size?: number;
  /** Pop the balls in one after another. */
  animate?: boolean;
}

/** A draw or ticket as a row of balls: main numbers, then supplementaries, then the Powerball. */
export function BallRow({ slug, main, supplementary = [], powerball = null, size = 40, animate = false }: BallRowProps) {
  const small = Math.round(size * 0.86);
  const pop = (index: number) => (animate ? ZoomIn.delay(index * 55).springify().damping(14) : undefined);

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {main.map((n, i) => (
        <Animated.View key={`m-${i}-${n}`} entering={pop(i)}>
          <NumberBall value={n} slug={slug} size={size} />
        </Animated.View>
      ))}
      {/* The "+" travels with the ball after it, so a wrapped row never ends on a dangling plus. */}
      {supplementary.length > 0 && (
        <View className="flex-row items-center gap-2">
          <AppText tone="muted" className="px-0.5 text-base font-bold">
            +
          </AppText>
          {supplementary.map((n, i) => (
            <Animated.View key={`s-${i}-${n}`} entering={pop(main.length + i)}>
              <NumberBall value={n} slug={slug} kind="supplementary" size={small} />
            </Animated.View>
          ))}
        </View>
      )}
      {powerball !== null && (
        <View className="flex-row items-center gap-2">
          <AppText tone="muted" className="px-0.5 text-base font-bold">
            +
          </AppText>
          <Animated.View entering={pop(main.length)}>
            <NumberBall value={powerball} slug={slug} kind="bonus" size={size} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}
