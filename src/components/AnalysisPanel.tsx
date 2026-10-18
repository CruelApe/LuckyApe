import { formatInt } from '@shared/format';
import type { GameSlug } from '@shared/types';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { GameAnalysis, NumberStat } from '@/lib';

import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { NumberBall } from './NumberBall';

const pct = (share: number) => `${Math.round(share * 100)}%`;

function Tile({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <GlassCard className={wide ? 'w-full p-4' : 'min-w-[46%] flex-1 p-4'}>
      <AppText tone="muted" className="mb-2 text-[11px] font-bold uppercase tracking-wider">
        {title}
      </AppText>
      {children}
    </GlassCard>
  );
}

function BallsWithCaption({ slug, stats, caption, kind = 'main', wide = false }: {
  slug: GameSlug;
  stats: NumberStat[];
  caption: (s: NumberStat) => string;
  kind?: 'main' | 'bonus';
  /** A full-width tile: keep the balls together instead of spreading them across it. */
  wide?: boolean;
}) {
  // Three 40px columns fit a half-width tile on a 360px phone; captions are kept short to match.
  return (
    <View className={wide ? 'flex-row gap-5' : 'flex-row justify-between'}>
      {stats.map((s) => (
        <View key={s.number} className="w-10 items-center gap-1">
          <NumberBall value={s.number} slug={slug} kind={kind} size={34} />
          <AppText tone="muted" className="text-center text-[10px]" numberOfLines={1}>
            {caption(s)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** "Instant analysis": what the recent draws say, in a handful of tiles. */
export function AnalysisPanel({ slug, analysis }: { slug: GameSlug; analysis: GameAnalysis }) {
  const hot = analysis.main.hot.slice(0, 3);
  const overdue = analysis.main.overdue.slice(0, 3);
  const split = analysis.mostCommonSplit;
  const { bounce, sum } = analysis;

  if (analysis.drawCount === 0) {
    return (
      <GlassCard className="p-4">
        <AppText tone="muted" className="text-sm">
          No draw history is available yet, so there is nothing to analyse. Generated numbers will be uniformly random.
        </AppText>
      </GlassCard>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-3">
        <Tile title="Top 3 hot numbers">
          <BallsWithCaption slug={slug} stats={hot} caption={(s) => `${s.count}×`} />
        </Tile>
        <Tile title="Most overdue">
          <BallsWithCaption
            slug={slug}
            stats={overdue}
            caption={(s) => (s.count === 0 ? `${s.gap}+ draws` : `${s.gap} draws`)}
          />
        </Tile>
        <Tile title="Odd : even">
          {split ? (
            <>
              <AppText className="text-2xl font-extrabold">
                {split.odd} : {split.even}
              </AppText>
              <AppText tone="muted" className="text-xs">
                most common · {pct(split.share)} of draws
              </AppText>
            </>
          ) : (
            <AppText tone="muted">—</AppText>
          )}
        </Tile>
        <Tile title="Typical sum">
          <AppText className="text-2xl font-extrabold">
            {sum.low}–{sum.high}
          </AppText>
          <AppText tone="muted" className="text-xs">
            {sum.empirical ? 'middle 80% of draws' : 'expected range (short history)'}
          </AppText>
        </Tile>
        {analysis.powerball && (
          <Tile title="Hot Powerball" wide>
            <BallsWithCaption
              slug={slug}
              wide
              kind="bonus"
              stats={analysis.powerball.hot.slice(0, 3)}
              caption={(s) => `${s.count}×`}
            />
          </Tile>
        )}
        <Tile title="Supplementary bounce" wide>
          {bounce.eligible > 0 ? (
            <>
              <AppText className="text-sm">
                <AppText className="text-2xl font-extrabold">{pct(bounce.rate)}</AppText> of carried-over numbers
                reappeared in the next draw
              </AppText>
              <AppText tone="muted" className="mt-1 text-xs">
                {bounce.hits} of {formatInt(bounce.eligible)} · chance alone predicts {pct(bounce.baseRate)} (×
                {bounce.lift.toFixed(2)}). A ratio near 1 means no real effect.
              </AppText>
            </>
          ) : (
            <AppText tone="muted" className="text-sm">
              Not enough draws to measure.
            </AppText>
          )}
        </Tile>
      </View>
      <AppText tone="muted" className="px-1 text-xs">
        Based on {analysis.drawCount} draws. Hot = drawn most (the × is how many times; recent draws count more). Overdue
        = absent longest, shown in draws since it last appeared.
      </AppText>
    </View>
  );
}
