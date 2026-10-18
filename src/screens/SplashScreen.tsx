import { BUILTIN_RULES } from '@shared/games';
import { GAME_SLUGS } from '@shared/types';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Logo } from '@/components/Logo';
import { ProgressBar } from '@/components/ProgressBar';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useTheme } from '@/components/ThemeRoot';
import { APP_INFO } from '@/constants/config';
import { gameQueryKey } from '@/hooks/useGame';
import { analysisFor } from '@/services/analysisCache';
import { preloadLabel, preloadPercent, type PreloadPhase } from '@/services/preload';
import { queryClient } from '@/services/queryClient';
import { loadGameRuntime } from '@/services/runtime';
import { runStartup, type StartupDeps } from '@/services/startup';

/** Keeps the brand on screen long enough to register even when everything is cached. */
const MIN_SPLASH_MS = 1600;
const FADE_MS = 450;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const startupDeps: StartupDeps = {
  slugs: GAME_SLUGS,
  gameName: (slug) => BUILTIN_RULES[slug].name,
  // fetchQuery stores the result under the same key the screens read, so they open instantly.
  load: (slug) =>
    queryClient.fetchQuery({ queryKey: gameQueryKey(slug), queryFn: () => loadGameRuntime(slug), staleTime: 0 }),
  analyze: (snapshot) => {
    analysisFor(snapshot);
  },
  nextFrame: () => wait(0), // let the bar repaint between games
  wait,
  now: Date.now,
  minDurationMs: MIN_SPLASH_MS,
};

/**
 * Branded launch screen. The progress bar reflects real work — fetching every game's draw
 * history, then computing its probability distributions — and fades into the game selector.
 */
export function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [phase, setPhase] = useState<PreloadPhase>({ kind: 'init' });
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const opacity = useSharedValue(1);
  const leaving = useRef(false);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  useEffect(() => {
    let cancelled = false;
    leaving.current = false;
    opacity.set(1);

    (async () => {
      const result = await runStartup(startupDeps, setPhase, () => cancelled);
      if (!result.completed) return;
      await wait(500); // let "Ready · 100%" be read
      if (cancelled || leaving.current) return;

      leaving.current = true;
      opacity.set(withTiming(0, { duration: FADE_MS }));
      await wait(FADE_MS);
      if (!cancelled) router.replace('/games');
    })().catch((error: unknown) => {
      console.error('[LuckyApe] start-up failed', error);
      if (!cancelled) setFailure(error instanceof Error ? error.message : 'Something went wrong while starting up.');
    });

    return () => {
      cancelled = true;
    };
  }, [attempt, opacity, router]);

  const percent = preloadPercent(phase);

  return (
    // Reanimated views take inline styles (NativeWind does not style them reliably).
    <Animated.View style={[{ flex: 1, backgroundColor: colors.background }, fade]}>
      <ScreenBackground />
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: 'center' }}>
          <Logo size={132} />
          <AppText accessibilityRole="header" className="mt-4 text-4xl font-black tracking-tight">
            Lucky Ape
          </AppText>
          <AppText tone="muted" className="mt-1 text-center text-sm">
            Smart Probability, Bananas Results.
          </AppText>
        </Animated.View>

        <View className="mt-14 w-full max-w-[360px] gap-3">
          <ProgressBar value={percent} />
          {failure ? (
            <View className="items-center gap-2">
              <AppText tone="danger" className="text-center text-sm">
                {failure}
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFailure(null);
                  setAttempt((n) => n + 1);
                }}
                className="min-h-11 items-center justify-center rounded-full bg-primary px-6 active:opacity-70"
              >
                <AppText tone="onPrimary" className="font-bold">
                  Try again
                </AppText>
              </Pressable>
            </View>
          ) : (
            <AppText tone="muted" accessibilityLiveRegion="polite" className="text-center text-sm">
              {preloadLabel(phase)}
            </AppText>
          )}
        </View>
      </View>

      <View style={{ paddingBottom: insets.bottom + 20 }} className="items-center">
        <AppText tone="muted" className="text-xs">
          {APP_INFO.poweredBy}
        </AppText>
      </View>
    </Animated.View>
  );
}
