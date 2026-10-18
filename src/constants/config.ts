import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 8787;

/**
 * Where an optional scraper service lives. The app does not need one: with none configured it
 * reads live results straight from The Lott (see services/directSource.ts).
 *  1. `EXPO_PUBLIC_API_URL` wins when set.
 *  2. In development, the machine running Metro is assumed to run the service too, which works
 *     for Expo Go on a phone, the iOS simulator and the Android emulator alike.
 *  3. Otherwise null: fetch from The Lott directly.
 */
export function resolveApiBase(): string | null {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  if (__DEV__) {
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host) return `http://${host}:${API_PORT}`;
    return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
  }
  return null;
}

export const APP_INFO = {
  name: 'Lucky Ape',
  tagline: 'Lucky Ape — Smart Probability, Bananas Results.',
  developer: 'Tyron James Gono',
  company: 'CruelApe Software',
  poweredBy: 'Powered by CruelApe Software',
  copyright: '© 2026 CruelApe Software. All Rights Reserved.',
  repoUrl: 'https://github.com/CruelApe/LuckyApe',
  version: Constants.expoConfig?.version ?? '1.0.2',
  gamblingHelp: { name: 'Gambling Help Online', phone: '1800 858 858', url: 'https://www.gamblinghelponline.org.au' },
} as const;
