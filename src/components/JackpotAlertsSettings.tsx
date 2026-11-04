import { BellRing } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Switch, View } from 'react-native';

import {
  MAX_THRESHOLD_MILLIONS,
  MIN_THRESHOLD_MILLIONS,
  THRESHOLD_PRESETS_MILLIONS,
  THRESHOLD_STEP_MILLIONS,
  formatThreshold,
} from '@/services/jackpotAlerts';
import {
  TEST_NOTIFICATION_DELAY_SECONDS,
  hasNotificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  sendTestNotification,
} from '@/services/notifications';
import { useAlertStore } from '@/store';

import { AppText } from './AppText';
import { Button } from './Button';
import { GlassCard } from './GlassCard';
import { Stepper } from './Stepper';
import { useTheme } from './ThemeRoot';

interface Problem {
  message: string;
  /** Only the phone's own settings can fix it: the system will not ask again. */
  canOpenSettings: boolean;
}

const DENIED: Problem = {
  message: 'Lucky Ape needs permission to show notifications. Allow it when asked to turn jackpot alerts on.',
  canOpenSettings: false,
};
const BLOCKED: Problem = {
  message: 'Notifications are switched off for Lucky Ape in your phone’s settings. Turn them on there, then come back.',
  canOpenSettings: true,
};
const FAILED: Problem = { message: 'Could not turn jackpot alerts on. Please try again.', canOpenSettings: false };
const FAILED_TEST: Problem = {
  message: 'Could not send the test notification. Check that notifications are allowed for Lucky Ape.',
  canOpenSettings: true,
};

/** The jackpot alert setting: on/off, the minimum jackpot to alert at, and a way to try a notification. */
export function JackpotAlertsSettings() {
  const { colors } = useTheme();
  const enabled = useAlertStore((s) => s.enabled);
  const thresholdMillions = useAlertStore((s) => s.thresholdMillions);
  const setEnabled = useAlertStore((s) => s.setEnabled);
  const setThreshold = useAlertStore((s) => s.setThreshold);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [asking, setAsking] = useState(false);
  const [testSent, setTestSent] = useState(false);

  // Alerts can be on while the phone's own switch has since been turned off: say so rather than stay silent.
  useEffect(() => {
    if (!enabled || !notificationsSupported) return;
    let cancelled = false;
    hasNotificationPermission()
      .then((allowed) => {
        if (!cancelled && !allowed) setProblem(BLOCKED);
      })
      .catch((error: unknown) => console.warn('[LuckyApe] could not read the notification permission', error));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const toggle = async (next: boolean) => {
    if (!next) {
      setEnabled(false);
      setProblem(null);
      return;
    }
    setAsking(true);
    try {
      const outcome = await requestNotificationPermission();
      if (outcome === 'granted') {
        setEnabled(true);
        setProblem(null);
      } else {
        setProblem(outcome === 'blocked' ? BLOCKED : DENIED);
      }
    } catch (error) {
      console.error('[LuckyApe] could not turn jackpot alerts on', error);
      setProblem(FAILED);
    } finally {
      setAsking(false);
    }
  };

  const sendTest = async () => {
    setTestSent(false);
    try {
      await sendTestNotification();
      setTestSent(true);
      setProblem(null);
    } catch (error) {
      console.error('[LuckyApe] could not send the test notification', error);
      setProblem(FAILED_TEST);
    }
  };

  return (
    <GlassCard className="gap-4 p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
          <BellRing size={22} color={colors.primary} />
        </View>
        <View className="flex-1">
          <AppText className="text-base font-extrabold">Jackpot alerts</AppText>
          <AppText tone="muted" className="text-xs leading-4">
            Get a notification when any game’s jackpot is at or above the minimum you choose.
          </AppText>
        </View>
        {asking ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Switch
            accessibilityLabel="Jackpot alerts"
            value={enabled}
            disabled={!notificationsSupported}
            onValueChange={(next) => void toggle(next)}
            trackColor={{ true: colors.primary, false: colors['surface-muted'] }}
            thumbColor={Platform.OS === 'android' ? colors.fg : undefined}
          />
        )}
      </View>

      {!notificationsSupported && (
        <AppText tone="muted" className="text-xs leading-4">
          Notifications are only available in the Android and iOS app, not on the web.
        </AppText>
      )}

      {problem && (
        <View
          accessibilityLiveRegion="polite"
          className="gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-3.5 py-3"
        >
          <AppText tone="danger" className="text-xs leading-4">
            {problem.message}
          </AppText>
          {problem.canOpenSettings && (
            <Button
              label="Open phone settings"
              variant="secondary"
              onPress={() =>
                Linking.openSettings().catch((error: unknown) =>
                  console.warn('[LuckyApe] could not open the phone settings', error),
                )
              }
            />
          )}
        </View>
      )}

      {enabled && (
        <>
          <Stepper
            label="Minimum jackpot"
            value={thresholdMillions}
            min={MIN_THRESHOLD_MILLIONS}
            max={MAX_THRESHOLD_MILLIONS}
            step={THRESHOLD_STEP_MILLIONS}
            format={formatThreshold}
            onChange={setThreshold}
            hint={`Alerts for any game’s jackpot of this amount or more · “Any” means every jackpot, up to ${formatThreshold(MAX_THRESHOLD_MILLIONS)}`}
            presets={THRESHOLD_PRESETS_MILLIONS}
          />
          <AppText tone="muted" className="text-xs leading-4">
            Lucky Ape checks the jackpots whenever it loads new results, and now and then in the background (your phone
            decides how often). You are alerted once when a jackpot gets to this minimum, not on every refresh, and
            again if it is won and builds back up to it. Tap an alert to open that game.
          </AppText>
          <View className="gap-2">
            <Button label="Send a test notification" variant="secondary" onPress={() => void sendTest()} />
            <AppText tone="muted" className="text-center text-xs leading-4">
              {testSent
                ? `Sent. It arrives in about ${TEST_NOTIFICATION_DELAY_SECONDS} seconds as a normal phone notification: leave the app or lock your phone and look in your notification shade.`
                : 'Alerts are ordinary phone notifications: they appear in your notification shade and on the lock screen, not inside the app.'}
            </AppText>
          </View>
        </>
      )}
    </GlassCard>
  );
}
