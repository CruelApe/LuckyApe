import { CircleArrowDown, CircleCheck, RefreshCw, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { APP_INFO } from '@/constants/config';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import { canInstallInApp, useUpdateInstall } from '@/hooks/useUpdateInstall';
import { openLink } from '@/services/links';
import { describeUpdateState, type UpdateView } from '@/services/updateCheck';

import { AppText, type Tone } from './AppText';
import { Button } from './Button';
import { GlassCard } from './GlassCard';
import { useTheme } from './ThemeRoot';
import { UpdateProgress } from './UpdateProgress';

type State = UpdateView['state'];

const ICON: Record<State, LucideIcon> = {
  idle: RefreshCw,
  checking: RefreshCw,
  available: CircleArrowDown,
  current: CircleCheck,
  failed: TriangleAlert,
};
const TONE: Record<State, Tone> = {
  idle: 'default',
  checking: 'default',
  available: 'primary',
  current: 'positive',
  failed: 'danger',
};
const ICON_COLOR = {
  idle: 'fg-muted',
  checking: 'fg-muted',
  available: 'primary',
  current: 'positive',
  failed: 'danger',
} as const satisfies Record<State, string>;

/** About screen: whether Lucky Ape is up to date, a button to ask again, and the update itself when there is one. */
export function UpdateCard() {
  const { colors } = useTheme();
  const { result, error, isFetching, refetch } = useUpdateCheck();
  const install = useUpdateInstall();

  const view = describeUpdateState({ isChecking: isFetching, result, error }, APP_INFO.version);
  const update = view.state === 'available' && result?.status === 'available' ? result.update : null;
  const inApp = update !== null && canInstallInApp(update);
  const Icon = ICON[view.state];
  const iconColor = colors[ICON_COLOR[view.state]];

  return (
    <GlassCard className="mt-4 gap-3 p-4">
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${view.title}. ${view.detail}`}
        className="flex-row items-start gap-3"
      >
        {view.state === 'checking' ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Icon size={20} color={iconColor} style={{ marginTop: 1 }} />
        )}
        <View className="flex-1">
          <AppText tone={TONE[view.state]} className="text-base font-extrabold">
            {view.title}
          </AppText>
          <AppText tone="muted" className="text-sm leading-5">
            {view.detail}
          </AppText>
        </View>
      </View>

      {update ? (
        <>
          {install.error && (
            <AppText tone="danger" className="text-sm leading-5">
              {install.error}
            </AppText>
          )}
          {install.progress ? (
            <UpdateProgress progress={install.progress} />
          ) : (
            <>
              <Button
                label={`${inApp ? (install.error ? 'Try again' : 'Update to') : 'Download'} v${update.version}`}
                onPress={() => void install.start(update)}
              />
              {inApp && (
                <AppText tone="muted" className="text-center text-xs leading-4">
                  Android may ask you to allow Lucky Ape to install updates the first time, then tap Install. Your saved
                  tickets are kept.
                </AppText>
              )}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Read the release notes for version ${update.version}`}
                onPress={() => openLink(update.releaseUrl, 'Could not open the release notes')}
                className="min-h-10 items-center justify-center active:opacity-60"
              >
                <AppText tone="accent" className="text-sm font-semibold">
                  Release notes
                </AppText>
              </Pressable>
            </>
          )}
        </>
      ) : (
        view.state !== 'checking' && (
          <Button label="Check for updates" icon={RefreshCw} variant="secondary" onPress={() => void refetch()} />
        )
      )}
    </GlassCard>
  );
}
