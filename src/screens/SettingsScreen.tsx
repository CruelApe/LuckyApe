import { useRouter } from 'expo-router';

import { JackpotAlertsSettings } from '@/components/JackpotAlertsSettings';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsSection } from '@/components/SettingsSection';
import { ThemeSettings } from '@/components/ThemeSettings';

/**
 * Settings: opened from the gear in the home header. Each group of settings is a `SettingsSection` holding
 * its own component, so a new setting is added here as one more section (or one more item in a section)
 * without touching how the others work.
 */
export function SettingsScreen() {
  const router = useRouter();

  return (
    <Screen
      header={
        <ScreenHeader
          title="Settings"
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/games'))}
        />
      }
    >
      <SettingsSection title="Appearance">
        <ThemeSettings />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <JackpotAlertsSettings />
      </SettingsSection>
    </Screen>
  );
}
