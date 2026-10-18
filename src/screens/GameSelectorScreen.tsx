import { GAME_SLUGS, type GameSlug } from '@shared/types';
import { useRouter } from 'expo-router';
import { Info, Library } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/AppText';
import { GameCard } from '@/components/GameCard';
import { IconButton } from '@/components/IconButton';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeRoot';
import { queryClient } from '@/services/queryClient';
import { useTicketStore } from '@/store';

const GAP = 12;

const chunk = <T,>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

/** Home: every supported game as a card, with the Light/Dark toggle, saved tickets and About in the header. */
export function GameSelectorScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const savedCount = useTicketStore((s) => s.tickets.length);
  const [refreshing, setRefreshing] = useState(false);

  const columns = width >= 720 ? 3 : width >= 340 ? 2 : 1;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['game'] });
    } finally {
      setRefreshing(false);
    }
  };

  const open = (slug: GameSlug) => router.push({ pathname: '/games/[slug]', params: { slug } });
  const howToPlay = (slug: GameSlug) => router.push({ pathname: '/rules/[slug]', params: { slug } });

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      header={
        <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-4">
          <View className="flex-row items-center gap-2.5">
            <Logo size={40} />
            <View>
              <AppText accessibilityRole="header" className="text-xl font-black leading-6">
                Lucky Ape
              </AppText>
              <AppText tone="muted" className="text-[11px]">
                Pick a game
              </AppText>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <ThemeToggle />
            <IconButton icon={Library} label="Saved tickets" badge={savedCount} onPress={() => router.push('/saved')} />
            <IconButton icon={Info} label="About Lucky Ape" onPress={() => router.push('/about')} />
          </View>
        </View>
      }
    >
      <View style={{ gap: GAP }}>
        {chunk(GAME_SLUGS, columns).map((row) => (
          <View key={row[0]} className="flex-row items-stretch" style={{ gap: GAP }}>
            {row.map((slug) => (
              <View key={slug} className="flex-1">
                <GameCard slug={slug} onOpen={() => open(slug)} onHowToPlay={() => howToPlay(slug)} />
              </View>
            ))}
            {/* keep a short last row aligned with the grid */}
            {Array.from({ length: columns - row.length }, (_, i) => (
              <View key={`spacer-${i}`} className="flex-1" />
            ))}
          </View>
        ))}
      </View>
      <AppText tone="muted" className="mt-6 px-1 text-center text-xs">
        An independent statistical tool, not affiliated with The Lott.
      </AppText>
    </Screen>
  );
}
