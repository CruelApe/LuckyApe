import { GAME_SLUGS } from '@shared/types';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import {
  DEFAULT_THRESHOLD_MILLIONS,
  clampThreshold,
  type AlertedJackpots,
} from '@/services/jackpotAlerts';

export interface AlertState {
  /** Notify when a jackpot reaches `thresholdMillions`. Off until the user turns it on (and allows notifications). */
  enabled: boolean;
  /** The amount to alert at, in millions of AUD. */
  thresholdMillions: number;
  /** Bookkeeping so one jackpot alerts once: see `evaluateJackpotAlerts`. Not a setting. */
  alerted: AlertedJackpots;
  setEnabled(enabled: boolean): void;
  setThreshold(millions: number): void;
  saveAlerted(alerted: AlertedJackpots): void;
}

const isAlertedJackpots = (value: unknown): value is AlertedJackpots =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Drops anything that is not a known game with a plain number, rather than trusting stored data. */
function cleanAlerted(value: unknown): AlertedJackpots {
  if (!isAlertedJackpots(value)) return {};
  const clean: AlertedJackpots = {};
  for (const slug of GAME_SLUGS) {
    const jackpot = (value as Record<string, unknown>)[slug];
    if (typeof jackpot === 'number' && Number.isFinite(jackpot)) clean[slug] = jackpot;
  }
  return clean;
}

export const createAlertStore = (storage: StateStorage) =>
  create<AlertState>()(
    persist(
      (set) => ({
        enabled: false,
        thresholdMillions: DEFAULT_THRESHOLD_MILLIONS,
        alerted: {},
        // Switching alerts on (or off) starts fresh: games already above the amount alert straight away, which is
        // also how the user finds out that alerts work. Otherwise a toggle would leave them silently "already alerted".
        setEnabled: (enabled) => set({ enabled, alerted: {} }),
        setThreshold: (millions) => set({ thresholdMillions: clampThreshold(millions) }),
        saveAlerted: (alerted) => set({ alerted }),
      }),
      {
        name: 'luckyape:alerts',
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({
          enabled: state.enabled,
          thresholdMillions: state.thresholdMillions,
          alerted: state.alerted,
        }),
        // A hand-edited or corrupt value must not leave alerts in a state the screen cannot show.
        merge: (persisted, current) => {
          const stored = (persisted ?? {}) as Partial<AlertState>;
          return {
            ...current,
            enabled: stored.enabled === true,
            thresholdMillions:
              typeof stored.thresholdMillions === 'number'
                ? clampThreshold(stored.thresholdMillions)
                : current.thresholdMillions,
            alerted: cleanAlerted(stored.alerted),
          };
        },
      },
    ),
  );
