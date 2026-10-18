import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import * as NativeSplash from 'expo-splash-screen';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeRoot, useTheme } from '@/components/ThemeRoot';
import { queryClient } from '@/services/queryClient';
import { useHydrated, useThemeStore, useTicketStore } from '@/store';

// Keep the native splash up until saved settings have loaded, so the first frame has the right theme.
NativeSplash.preventAutoHideAsync().catch(() => undefined);

/** The navigator, themed from the same tokens as the rest of the UI. */
function ThemedStack() {
  const { scheme, colors } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.fg,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="games/index" />
        <Stack.Screen name="games/[slug]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="saved" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="about" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="rules/[slug]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const themeReady = useHydrated(useThemeStore);
  const ticketsReady = useHydrated(useTicketStore);
  const ready = themeReady && ticketsReady;

  useEffect(() => {
    if (ready) NativeSplash.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeRoot>
            <ThemedStack />
          </ThemeRoot>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
