import { useRouter } from 'expo-router';
import { Code, ExternalLink, ShieldCheck, X } from 'lucide-react-native';
import { Linking, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { GlassCard } from '@/components/GlassCard';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTheme } from '@/components/ThemeRoot';
import { APP_INFO } from '@/constants/config';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-4 py-2.5">
      <AppText tone="muted" className="text-sm">
        {label}
      </AppText>
      <AppText className="flex-1 text-right text-sm font-semibold">{value}</AppText>
    </View>
  );
}

/** Developer profile, branding, copyright and the legal disclaimer. */
export function AboutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const help = APP_INFO.gamblingHelp;

  return (
    <Screen
      header={
        <ScreenHeader
          title="About"
          backIcon={X}
          backLabel="Close"
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/games'))}
        />
      }
    >
      <View className="items-center gap-1 pb-5 pt-2">
        <Logo size={112} />
        <AppText accessibilityRole="header" className="mt-3 text-3xl font-black">
          {APP_INFO.name}
        </AppText>
        <AppText tone="muted" className="text-center text-sm">
          {APP_INFO.tagline}
        </AppText>
        <View className="mt-2 rounded-full bg-primary/15 px-3 py-1">
          <AppText tone="accent" className="text-xs font-bold">
            Version {APP_INFO.version}
          </AppText>
        </View>
      </View>

      <GlassCard className="px-4 py-1">
        <Row label="Developer" value={APP_INFO.developer} />
        <View className="h-px bg-border" />
        <Row label="Company" value={APP_INFO.poweredBy} />
        <View className="h-px bg-border" />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open the Lucky Ape source code repository on GitHub"
          onPress={() => Linking.openURL(APP_INFO.repoUrl)}
          className="flex-row items-center justify-between gap-4 py-2.5 active:opacity-60"
        >
          <View className="flex-row items-center gap-2">
            <Code size={16} color={colors['fg-muted']} />
            <AppText tone="muted" className="text-sm">
              Repository
            </AppText>
          </View>
          <View className="flex-1 flex-row items-center justify-end gap-1.5">
            <AppText tone="accent" className="text-sm font-semibold" numberOfLines={1}>
              CruelApe/LuckyApe
            </AppText>
            <ExternalLink size={14} color={colors.accent} />
          </View>
        </Pressable>
      </GlassCard>

      <GlassCard className="mt-4 gap-2 p-4">
        <View className="flex-row items-center gap-2">
          <ShieldCheck size={18} color={colors.accent} />
          <AppText className="text-base font-extrabold">Disclaimer</AppText>
        </View>
        <AppText tone="muted" className="text-sm leading-5">
          Lucky Ape is an independent statistical tool. It is not affiliated with, endorsed by or connected to The
          Lott, The Lottery Corporation or Tatts Group. Game names and results belong to their respective owners and
          are used only to identify the games.
        </AppText>
        <AppText tone="muted" className="text-sm leading-5">
          Draw data is read from The Lott&apos;s public pages and may be incomplete or out of date — always check official
          results. Lottery draws are random and independent: Lucky Ape cannot predict a draw or improve your chance of
          winning, it only helps you choose numbers using different methods.
        </AppText>
        <AppText tone="muted" className="text-sm leading-5">
          You must be 18 or over to play. If gambling is a problem for you or someone you know, contact{' '}
          <AppText
            tone="accent"
            accessibilityRole="link"
            className="font-semibold"
            onPress={() => Linking.openURL(`tel:${help.phone.replace(/\s/g, '')}`)}
          >
            {help.name} on {help.phone}
          </AppText>
          .
        </AppText>
      </GlassCard>

      <View className="items-center gap-0.5 pb-2 pt-6">
        <AppText className="text-sm font-semibold">{APP_INFO.poweredBy}</AppText>
        <AppText tone="muted" className="text-center text-xs">
          {APP_INFO.copyright}
        </AppText>
      </View>
    </Screen>
  );
}
