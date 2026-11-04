import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationPriority, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';

import { alertNotificationData, jackpotAlertMessage, type JackpotAlert } from './jackpotAlerts';

/** Jackpot alerts need the phone's notification system, which the web build does not have. */
export const notificationsSupported = Platform.OS !== 'web';

export const JACKPOT_CHANNEL_ID = 'jackpot-alerts';

// Module scope on purpose: the background check runs without any screen, and a notification is only
// shown if a handler was registered by the time it arrives. (Foreground alerts show as a banner too.)
if (notificationsSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let channelFailureLogged = false;

/**
 * Android 8+ shows notifications by channel (it is also what the user sees in system settings). Safe to repeat.
 *
 * Best effort on purpose: if the channel cannot be created (some hosts, e.g. Expo Go, reject it), a notification
 * aimed at the missing channel is still delivered, on expo-notifications' default fallback channel. Failing here
 * would stop alerts being turned on at all, over something that only changes how the alert is categorised.
 */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(JACKPOT_CHANNEL_ID, {
      name: 'Jackpot alerts',
      description: 'A game’s jackpot has reached the amount you chose.',
      importance: AndroidImportance.HIGH,
    });
  } catch (error) {
    if (!channelFailureLogged) {
      channelFailureLogged = true;
      console.warn('[LuckyApe] could not create the "Jackpot alerts" notification channel; using the default channel', error);
    }
  }
}

export type PermissionOutcome = 'granted' | 'denied' | 'blocked';

/**
 * Ask to show notifications, if that can still be asked. `blocked` means the system will no longer
 * show the prompt, so the only way to allow it is the phone's own settings.
 */
export async function requestNotificationPermission(): Promise<PermissionOutcome> {
  await ensureChannel(); // Android 13+ will not show the prompt until the app has a channel
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.granted) return 'granted';
  return permission.canAskAgain ? 'denied' : 'blocked';
}

export async function hasNotificationPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Show a jackpot alert now. Rejects if notifications are not allowed, so the caller does not mark it as sent. */
export async function notifyJackpot(alert: JackpotAlert, thresholdMillions: number): Promise<void> {
  if (!(await hasNotificationPermission())) throw new Error('Notifications are not allowed for Lucky Ape');
  await ensureChannel();

  const { title, body } = jackpotAlertMessage(alert, thresholdMillions);
  await Notifications.scheduleNotificationAsync({
    // One notification per game: a newer alert for the same game replaces the old one instead of stacking.
    identifier: `jackpot-${alert.slug}`,
    content: { title, body, data: alertNotificationData(alert), priority: AndroidNotificationPriority.HIGH },
    trigger: Platform.OS === 'android' ? { channelId: JACKPOT_CHANNEL_ID } : null,
  });
}

/** How long the test notification waits, so there is time to leave the app or lock the phone first. */
export const TEST_NOTIFICATION_DELAY_SECONDS = 10;

/**
 * Schedule a notification that arrives a few seconds from now, through exactly the same channel and
 * permission as a real jackpot alert, so the user can watch it land in the phone's notification shade.
 * Tapping it opens Powerball, to try the tap-to-open path too. Rejects if notifications are not allowed.
 */
export async function sendTestNotification(): Promise<void> {
  if (!(await hasNotificationPermission())) throw new Error('Notifications are not allowed for Lucky Ape');
  await ensureChannel();

  await Notifications.scheduleNotificationAsync({
    identifier: 'jackpot-test',
    content: {
      title: 'Test alert · Lucky Ape',
      body: 'Jackpot alerts are working. Tap to open Powerball.',
      data: alertNotificationData({ slug: 'powerball', jackpot: 0 }),
      priority: AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: TEST_NOTIFICATION_DELAY_SECONDS,
      ...(Platform.OS === 'android' ? { channelId: JACKPOT_CHANNEL_ID } : {}),
    },
  });
}
