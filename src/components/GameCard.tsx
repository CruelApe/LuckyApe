import { formatDate, formatJackpot } from '@shared/format';
import { BUILTIN_RULES } from '@shared/games';
import type { GameSlug } from '@shared/types';
import { BookOpen } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { GAME_BRAND } from '@/constants/gameBrand';
import { withAlpha } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';
import { describeRules } from '@/lib';

import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { useTheme } from './ThemeRoot';

interface GameCardProps {
  slug: GameSlug;
  onOpen: () => void;
  onHowToPlay: () => void;
}

/** One tile on the game selector: branding, last draw, jackpot, and a "How to Play" shortcut. */
export function GameCard({ slug, onOpen, onHowToPlay }: GameCardProps) {
  const { colors } = useTheme();
  const brand = GAME_BRAND[slug];
  const Icon = brand.icon;
  const { loaded, isPending } = useGame(slug);

  const snapshot = loaded?.snapshot;
  const rules = snapshot?.rules ?? BUILTIN_RULES[slug];
  const lastDraw = formatDate(snapshot?.lastDrawDate ?? snapshot?.draws[0]?.date ?? null);
  const jackpot = formatJackpot(snapshot?.jackpot ?? null);
  const isSample = loaded !== undefined && (loaded.origin === 'offline' || loaded.snapshot.source === 'sample');

  return (
    <GlassCard className="flex-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${rules.name}. Last draw ${lastDraw}. Jackpot ${jackpot}. Opens the combination generator.`}
        onPress={onOpen}
        className="gap-3 p-4 active:opacity-70"
      >
        <View className="flex-row items-start justify-between">
          <View
            className="h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: withAlpha(brand.accent, 0.2) }}
          >
            <Icon size={22} color={brand.accent} />
          </View>
          {isSample && (
            <View className="rounded-full bg-hot/15 px-2 py-0.5">
              <AppText tone="hot" className="text-[10px] font-bold">
                SAMPLE
              </AppText>
            </View>
          )}
        </View>

        <View className="min-h-[64px] gap-0.5">
          <AppText className="text-base font-extrabold leading-5" numberOfLines={2}>
            {rules.name}
          </AppText>
          <AppText tone="muted" className="text-xs" numberOfLines={2}>
            {describeRules(rules)}
          </AppText>
        </View>

        <View className="gap-2">
          <View>
            <AppText tone="muted" className="text-[11px] uppercase tracking-wider">
              Last draw
            </AppText>
            <AppText className="text-sm font-semibold">{isPending ? 'Loading…' : lastDraw}</AppText>
          </View>
          <View>
            <AppText tone="muted" className="text-[11px] uppercase tracking-wider">
              Jackpot
            </AppText>
            <AppText className="text-xl font-extrabold">{isPending ? '…' : jackpot}</AppText>
          </View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`How to play ${rules.name}`}
        onPress={onHowToPlay}
        className="flex-row items-center justify-center gap-2 border-t border-border py-3 active:opacity-60"
      >
        <BookOpen size={15} color={colors.accent} />
        <AppText tone="accent" className="text-sm font-semibold">
          How to Play
        </AppText>
      </Pressable>
    </GlassCard>
  );
}
