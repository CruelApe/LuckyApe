import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { Scheme, ThemeMode } from '@/constants/theme';

export interface ThemeState {
  mode: ThemeMode;
  setMode(mode: ThemeMode): void;
  /** Flip away from whatever is currently showing; the result is an explicit choice, not "system". */
  toggle(current: Scheme): void;
}

const MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

export const createThemeStore = (storage: StateStorage) =>
  create<ThemeState>()(
    persist(
      (set) => ({
        mode: 'system',
        setMode: (mode) => set({ mode }),
        toggle: (current) => set({ mode: current === 'dark' ? 'light' : 'dark' }),
      }),
      {
        name: 'luckyape:theme',
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ mode: state.mode }),
        // A hand-edited or corrupt value must not leave the app without a theme.
        merge: (persisted, current) => {
          const mode = (persisted as Partial<ThemeState> | undefined)?.mode;
          return { ...current, mode: MODES.includes(mode as ThemeMode) ? (mode as ThemeMode) : current.mode };
        },
      },
    ),
  );
