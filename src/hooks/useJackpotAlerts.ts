import { useEffect } from 'react';

import { readingsFromGames } from '@/services/jackpotAlerts';
import { checkJackpots } from '@/services/jackpotRuntime';
import { syncJackpotTask } from '@/services/jackpotTask';
import { notificationsSupported } from '@/services/notifications';
import { queryClient } from '@/services/queryClient';
import { cachedGames, watchGameQueries } from '@/services/jackpotWatcher';
import { useAlertStore } from '@/store';
import type { LoadedGame } from '@/services/gameData';

/** Wait for the amount to stop changing (it is set by tapping − / +) before checking against it. */
const SETTINGS_SETTLE_MS = 1_200;

const check = (games: readonly LoadedGame[]) => {
  checkJackpots(readingsFromGames(games)).catch((error: unknown) => {
    console.warn('[LuckyApe] jackpot check failed', error);
  });
};

/**
 * Keeps jackpot alerts running while the app is open: checks every game as its data arrives, checks again
 * when alerts are turned on or the amount changes, and keeps the background check registered while on.
 * Mount once, below the stores and query provider. Renders nothing.
 */
export function useJackpotAlerts(): void {
  const enabled = useAlertStore((s) => s.enabled);

  useEffect(() => {
    if (!notificationsSupported) return;

    const stopWatching = watchGameQueries(queryClient, (game) => check([game]));

    let settle: ReturnType<typeof setTimeout> | undefined;
    const stopSettings = useAlertStore.subscribe((state, previous) => {
      if (state.enabled === previous.enabled && state.thresholdMillions === previous.thresholdMillions) return;
      clearTimeout(settle);
      settle = setTimeout(() => check(cachedGames(queryClient)), SETTINGS_SETTLE_MS);
    });

    // The splash may have loaded the games before this was mounted.
    check(cachedGames(queryClient));

    return () => {
      stopWatching();
      stopSettings();
      clearTimeout(settle);
    };
  }, []);

  useEffect(() => {
    void syncJackpotTask(enabled);
  }, [enabled]);
}
