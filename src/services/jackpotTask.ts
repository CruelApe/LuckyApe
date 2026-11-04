import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { useAlertStore } from '@/store';

import { readingsFromOpenDraws } from './jackpotAlerts';
import { checkJackpots } from './jackpotRuntime';
import { notificationsSupported } from './notifications';
import { fetchLiveJackpots } from './runtime';

export const JACKPOT_TASK = 'luckyape-jackpot-check';

/**
 * How often the phone is asked to run the check. Android will not go below 15 minutes and, like iOS,
 * runs it when it suits the battery, so this is "about hourly, when the system allows", not a schedule.
 */
const MIN_INTERVAL_MINUTES = 60;

// Must be defined at module scope: when the system wakes the app for the task there is no screen, and
// this file being imported at start-up is the only way the task is known.
if (notificationsSupported) {
  TaskManager.defineTask(JACKPOT_TASK, async () => {
    try {
      // This may be a fresh process whose saved settings have not been read yet.
      await useAlertStore.persist.rehydrate();
      if (!useAlertStore.getState().enabled) return BackgroundTask.BackgroundTaskResult.Success;

      await checkJackpots(readingsFromOpenDraws(await fetchLiveJackpots()));
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.error('[LuckyApe] background jackpot check failed', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Make the background check run exactly while alerts are on. Never throws: the check is a bonus on top of the in-app one. */
export async function syncJackpotTask(enabled: boolean): Promise<void> {
  if (!notificationsSupported) return;
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(JACKPOT_TASK);
    if (enabled && !registered) {
      const status = await BackgroundTask.getStatusAsync();
      if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
        console.warn('[LuckyApe] background tasks are restricted on this device; alerts will only fire while the app is used');
        return;
      }
      await BackgroundTask.registerTaskAsync(JACKPOT_TASK, { minimumInterval: MIN_INTERVAL_MINUTES });
    } else if (!enabled && registered) {
      await BackgroundTask.unregisterTaskAsync(JACKPOT_TASK);
    }
  } catch (error) {
    console.warn('[LuckyApe] could not update the background jackpot check', error);
  }
}
