import { colorScheme, useColorScheme, vars } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import { View } from 'react-native';

import { colorsFor, cssVars, type Scheme, type ThemeMode, type TokenName } from '@/constants/theme';
import { useThemeStore } from '@/store';

interface ThemeValue {
  /** What is actually showing right now. */
  scheme: Scheme;
  /** What the user chose (`system` follows the device). */
  mode: ThemeMode;
  /** Theme colours as hex, for props that cannot take a className (icons, navigation). */
  colors: Record<TokenName, string>;
  setMode(mode: ThemeMode): void;
  toggle(): void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeRoot>');
  return value;
}

/**
 * Owns the Light / Dark switch. The store's `mode` drives NativeWind's colour scheme, and the
 * resolved scheme's colour tokens are injected as CSS variables, so every `bg-surface`,
 * `text-fg`, ... class below this point follows the toggle.
 */
export function ThemeRoot({ children }: PropsWithChildren) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const toggleStore = useThemeStore((s) => s.toggle);
  const { colorScheme: resolved } = useColorScheme();

  useEffect(() => {
    colorScheme.set(mode);
  }, [mode]);

  // The brand is dark-first, so an unresolved scheme (first frame) renders dark rather than flashing white.
  const scheme: Scheme = resolved === 'light' ? 'light' : 'dark';
  const value = useMemo<ThemeValue>(
    () => ({ scheme, mode, colors: colorsFor(scheme), setMode, toggle: () => toggleStore(scheme) }),
    [scheme, mode, setMode, toggleStore],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View className="flex-1 bg-background" style={vars(cssVars(scheme))}>
        {children}
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </View>
    </ThemeContext.Provider>
  );
}
