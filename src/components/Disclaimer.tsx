import { Linking, Pressable, View } from 'react-native';

import { APP_INFO } from '@/constants/config';

import { AppText } from './AppText';

/** Shown on the generator: what the numbers are (and are not), and where to get help. */
export function Disclaimer() {
  const help = APP_INFO.gamblingHelp;
  return (
    <View className="gap-1.5 px-1 pt-2">
      <AppText tone="muted" className="text-xs leading-4">
        Every lottery draw is random and independent. These statistics describe the past; they cannot predict the
        next draw or improve your odds. Lucky Ape only helps you choose numbers differently.
      </AppText>
      <View className="flex-row flex-wrap items-center gap-x-1">
        <AppText tone="muted" className="text-xs leading-4">
          Play responsibly.
        </AppText>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Call ${help.name} on ${help.phone}`}
          onPress={() => Linking.openURL(`tel:${help.phone.replace(/\s/g, '')}`)}
        >
          <AppText tone="accent" className="text-xs font-semibold leading-4">
            {help.name} {help.phone}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
