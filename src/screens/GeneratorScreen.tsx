import { formatDate, formatInt } from '@shared/format';
import { BUILTIN_RULES } from '@shared/games';
import type { DataSource, GameSlug } from '@shared/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { BookOpen, Dices, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, Switch, View } from 'react-native';

import { AnalysisPanel } from '@/components/AnalysisPanel';
import { AppText } from '@/components/AppText';
import { BallRow } from '@/components/BallRow';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DataOriginBanner } from '@/components/DataOriginBanner';
import { Disclaimer } from '@/components/Disclaimer';
import { GlassCard } from '@/components/GlassCard';
import { IconButton } from '@/components/IconButton';
import { ModeSelector } from '@/components/ModeSelector';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionTitle } from '@/components/SectionTitle';
import { Stepper } from '@/components/Stepper';
import { TicketCard } from '@/components/TicketCard';
import { useTheme } from '@/components/ThemeRoot';
import { STRATEGIES } from '@/constants/modes';
import { useGame } from '@/hooks/useGame';
import {
  describeRules,
  generateTickets,
  isPickGame,
  MAX_COMBINATIONS,
  systemGameCount,
  systemRangeFor,
  type GameAnalysis,
  type GeneratedTicket,
  type GeneratorMode,
  type PickGameRules,
  type Strategy,
} from '@/lib';
import { useTicketStore } from '@/store';

/** Quick picks for the Combinations stepper; 50 taps of "+" would be a chore. */
const COMBINATION_PRESETS = [1, 5, 10, 25, MAX_COMBINATIONS] as const;
/** Only the first few cards pop their balls in; fifty simultaneous entrance animations would stutter on a modest phone. */
const ANIMATED_TICKETS = 10;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

interface Options {
  mode: GeneratorMode;
  count: number;
  /** What the user asked for; the size actually used is clamped to the game's range. */
  requestedSize: number | null;
  basedOn: Strategy;
  powerHit: boolean;
}

const DEFAULT_OPTIONS: Options = { mode: 'balanced', count: 3, requestedSize: null, basedOn: 'balanced', powerHit: false };

interface Generated {
  tickets: GeneratedTicket[];
  error: string | null;
}

/** The System size actually used: the request, kept inside the game's (PowerHit-dependent) range. */
function effectiveSystemSize(rules: PickGameRules, options: Options): number {
  const range = systemRangeFor(rules, options.powerHit);
  return range ? clamp(options.requestedSize ?? range.min, range.min, range.max) : 0;
}

function generate(rules: PickGameRules, analysis: GameAnalysis, dataSource: DataSource, options: Options): Generated {
  try {
    return {
      tickets: generateTickets({
        rules,
        analysis,
        mode: options.mode,
        count: options.count,
        dataSource,
        system:
          options.mode === 'system'
            ? { size: effectiveSystemSize(rules, options), basedOn: options.basedOn, powerHit: options.powerHit }
            : undefined,
      }),
      error: null,
    };
  } catch (cause) {
    console.error('[LuckyApe] generation failed', cause);
    return { tickets: [], error: cause instanceof Error ? cause.message : 'Could not generate combinations.' };
  }
}

interface PickGeneratorProps {
  rules: PickGameRules;
  analysis: GameAnalysis;
  dataSource: DataSource;
  slug: GameSlug;
  onOpenRules: () => void;
}

/**
 * The analysis dashboard and generator for a game where the player chooses numbers. Combinations are
 * (re)generated from event handlers, never from effects; the parent remounts this component when
 * fresh data arrives, which produces a new first set.
 */
function PickGenerator({ rules, analysis, dataSource, slug, onOpenRules }: PickGeneratorProps) {
  const { colors } = useTheme();
  const savedTickets = useTicketStore((s) => s.tickets);
  const saveTicket = useTicketStore((s) => s.save);
  const removeTicket = useTicketStore((s) => s.remove);

  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<Generated>(() => generate(rules, analysis, dataSource, DEFAULT_OPTIONS));

  /** Apply an option change and produce a fresh set to match it. */
  const change = (patch: Partial<Options>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    setResult(generate(rules, analysis, dataSource, next));
  };
  const regenerate = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setResult(generate(rules, analysis, dataSource, options));
  };

  const systemRange = systemRangeFor(rules, options.powerHit);
  const systemSize = effectiveSystemSize(rules, options);
  const availableModes: GeneratorMode[] = ['hot', 'cold', 'balanced', 'bounce', ...(rules.system ? (['system'] as const) : [])];
  const savedIds = new Set(savedTickets.map((t) => t.id));

  return (
    <>
      <SectionTitle>Instant analysis</SectionTitle>
      <AnalysisPanel slug={slug} analysis={analysis} />

      <SectionTitle>Generator</SectionTitle>
      <ModeSelector value={options.mode} onChange={(mode) => change({ mode })} available={availableModes} />

      <GlassCard className="mt-4 gap-4 p-4">
        {options.mode === 'system' && systemRange && (
          <>
            <Stepper
              label="Numbers in your system"
              value={systemSize}
              min={systemRange.min}
              max={systemRange.max}
              onChange={(requestedSize) => change({ requestedSize })}
              hint={`${systemRange.min}–${systemRange.max} allowed · covers ${formatInt(systemGameCount(rules, systemSize))} games`}
            />
            <View className="gap-2">
              <AppText className="text-sm font-semibold">Pick the numbers using</AppText>
              <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                {STRATEGIES.map(({ id, label }) => (
                  <Chip key={id} label={label} selected={options.basedOn === id} onPress={() => change({ basedOn: id })} />
                ))}
              </View>
            </View>
            {rules.powerHitSystem && (
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <AppText className="text-sm font-semibold">PowerHit</AppText>
                  <AppText tone="muted" className="text-xs">
                    Powerball is guaranteed; {rules.powerHitSystem.min}–{rules.powerHitSystem.max} numbers
                  </AppText>
                </View>
                <Switch
                  accessibilityLabel="PowerHit system entry"
                  value={options.powerHit}
                  onValueChange={(powerHit) => change({ powerHit })}
                  trackColor={{ true: colors.primary, false: colors['surface-muted'] }}
                  thumbColor={Platform.OS === 'android' ? colors.fg : undefined}
                />
              </View>
            )}
          </>
        )}
        <Stepper
          label="Combinations"
          value={options.count}
          min={1}
          max={MAX_COMBINATIONS}
          onChange={(count) => change({ count })}
          hint={`1–${MAX_COMBINATIONS} allowed`}
          presets={COMBINATION_PRESETS}
        />
        <Button label="Re-generate" icon={RefreshCw} onPress={regenerate} />
      </GlassCard>

      <View className="mt-4 gap-3" accessibilityLiveRegion="polite">
        {result.error ? (
          <AppText tone="danger" className="text-sm">
            {result.error}
          </AppText>
        ) : (
          result.tickets.map((ticket, i) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              index={i + 1}
              gameName={rules.name}
              animate={i < ANIMATED_TICKETS}
              saved={savedIds.has(ticket.id)}
              onToggleSave={() => (savedIds.has(ticket.id) ? removeTicket(ticket.id) : saveTicket(ticket))}
            />
          ))
        )}
      </View>

      <View className="mt-5">
        <Button label="View How to Play Rules" icon={BookOpen} variant="secondary" onPress={onOpenRules} />
      </View>
      <Disclaimer />
    </>
  );
}

/** One game: where its data came from, then either the generator or (for allocated games) an explanation. */
export function GeneratorScreen({ slug }: { slug: GameSlug }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { loaded, analysis } = useGame(slug);

  const snapshot = loaded?.snapshot;
  const rules = snapshot?.rules ?? BUILTIN_RULES[slug];
  const openRules = () => router.push({ pathname: '/rules/[slug]', params: { slug } });

  return (
    <Screen
      header={
        <ScreenHeader
          title={rules.name}
          subtitle={describeRules(rules)}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/games'))}
          right={<IconButton icon={BookOpen} label={`How to play ${rules.name}`} onPress={openRules} />}
        />
      }
    >
      {!loaded || !snapshot ? (
        <View className="items-center gap-3 py-20">
          <ActivityIndicator color={colors.primary} />
          <AppText tone="muted" className="text-sm">
            Crunching the numbers…
          </AppText>
        </View>
      ) : (
        <View className="gap-1">
          <DataOriginBanner loaded={loaded} />

          {isPickGame(rules) && analysis ? (
            <PickGenerator
              // New data means a new first set of combinations.
              key={`${snapshot.fetchedAt}:${snapshot.source}`}
              rules={rules}
              analysis={analysis}
              dataSource={snapshot.source}
              slug={slug}
              onOpenRules={openRules}
            />
          ) : (
            <View className="gap-4 pt-4">
              <GlassCard className="gap-3 p-4">
                <View className="flex-row items-center gap-2">
                  <Dices size={20} color={colors.accent} />
                  <AppText className="text-base font-extrabold">Nothing to choose here</AppText>
                </View>
                <AppText tone="muted" className="text-sm leading-5">
                  {rules.allocatedNote}
                </AppText>
                <AppText tone="muted" className="text-sm leading-5">
                  When the numbers are allocated to you, no statistical model can give you an edge, so Lucky Ape does
                  not generate combinations for this game.
                </AppText>
              </GlassCard>

              {snapshot.draws.length > 0 && (
                <>
                  <AppText className="text-lg font-extrabold">Recent results</AppText>
                  <View className="gap-3">
                    {snapshot.draws.slice(0, 5).map((draw) => (
                      <GlassCard key={draw.date} className="gap-2 p-4">
                        <AppText tone="muted" className="text-xs">
                          {formatDate(draw.date)}
                          {draw.drawNumber ? ` · Draw ${draw.drawNumber}` : ''}
                        </AppText>
                        <BallRow slug={slug} main={draw.main} size={36} />
                      </GlassCard>
                    ))}
                  </View>
                </>
              )}
              <Button label="View How to Play Rules" icon={BookOpen} variant="secondary" onPress={openRules} />
              <Disclaimer />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
