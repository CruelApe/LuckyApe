import { formatOdds } from '@shared/format';
import { BUILTIN_RULES, isGameSlug } from '@shared/games';
import { useRouter } from 'expo-router';
import { ExternalLink, X } from 'lucide-react-native';
import { Linking, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Disclaimer } from '@/components/Disclaimer';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionTitle } from '@/components/SectionTitle';
import { useGame } from '@/hooks/useGame';
import { describeRules, howToPlaySteps } from '@/lib';

/** How to play, in numbers: built from the rules a scraper service confirmed (or the built-in ones). */
export function RulesScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const known = isGameSlug(slug);
  const { loaded } = useGame(known ? slug : 'tattslotto');

  const close = () => (router.canGoBack() ? router.back() : router.replace('/games'));
  if (!known) {
    return (
      <Screen header={<ScreenHeader title="Unknown game" backIcon={X} backLabel="Close" onBack={close} />}>
        <AppText tone="muted">There is no game called “{slug}”.</AppText>
      </Screen>
    );
  }

  const rules = loaded?.snapshot.rules ?? BUILTIN_RULES[slug];
  const confirmed = loaded?.snapshot.rulesSource === 'scraped';

  return (
    <Screen header={<ScreenHeader title="How to play" subtitle={rules.name} backIcon={X} backLabel="Close" onBack={close} />}>
      <GlassCard className="gap-1 p-4">
        <AppText className="text-lg font-extrabold">{rules.name}</AppText>
        <AppText tone="muted" className="text-sm">
          {describeRules(rules)}
        </AppText>
        <AppText tone={confirmed ? 'positive' : 'muted'} className="mt-1 text-xs font-semibold">
          {confirmed ? 'Rules confirmed against thelott.com' : 'Built-in rules — not re-checked against thelott.com'}
        </AppText>
      </GlassCard>

      <SectionTitle>The basics</SectionTitle>
      <View className="gap-3">
        {howToPlaySteps(rules).map((step, i) => (
          <View key={i} className="flex-row gap-3">
            <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-primary">
              <AppText tone="onPrimary" className="text-xs font-extrabold">
                {i + 1}
              </AppText>
            </View>
            <AppText className="flex-1 text-sm leading-5">{step}</AppText>
          </View>
        ))}
      </View>

      {rules.divisions.length > 0 && (
        <>
          <SectionTitle>Prize divisions and odds</SectionTitle>
          <GlassCard className="px-4 py-1">
            {rules.divisions.map((d, i) => (
              <View key={d.division}>
                {i > 0 && <View className="h-px bg-border" />}
                <View className="flex-row items-center gap-3 py-3">
                  <AppText tone="accent" className="w-14 text-sm font-extrabold">
                    Div {d.division}
                  </AppText>
                  <AppText className="flex-1 text-sm">{d.match}</AppText>
                  <AppText tone="muted" className="text-right text-xs">
                    {formatOdds(d.oddsOneIn)}
                  </AppText>
                </View>
              </View>
            ))}
          </GlassCard>
          <AppText tone="muted" className="mt-2 px-1 text-xs">
            Odds are for a single standard game.
          </AppText>
        </>
      )}

      <View className="mt-6 gap-3">
        <Button
          label="Open the official page"
          icon={ExternalLink}
          variant="secondary"
          accessibilityHint="Opens thelott.com in your browser"
          onPress={() => Linking.openURL(rules.howToPlayUrl)}
        />
        <Disclaimer />
      </View>
    </Screen>
  );
}
