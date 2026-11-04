import { useAlertStore } from '@/store';

import { runJackpotAlerts, type JackpotAlert, type JackpotReading } from './jackpotAlerts';
import { notifyJackpot } from './notifications';

/**
 * The app's real jackpot check: the user's saved settings, and real notifications. Used by the screens
 * (as fresh data arrives) and by the background task, which is why it takes plain readings.
 */
export const checkJackpots = (readings: readonly JackpotReading[]): Promise<JackpotAlert[]> =>
  runJackpotAlerts(readings, {
    getSettings: () => useAlertStore.getState(),
    saveAlerted: (alerted) => useAlertStore.getState().saveAlerted(alerted),
    notify: notifyJackpot,
    warn: (message, error) => console.warn(`[LuckyApe] ${message}`, error ?? ''),
  });
