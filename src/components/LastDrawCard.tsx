import { formatDate } from '@shared/format';
import type { Draw, GameSlug } from '@shared/types';
import { View } from 'react-native';

import { AppText } from './AppText';
import { Badge } from './Badge';
import { BallRow } from './BallRow';
import { GlassCard } from './GlassCard';

interface LastDrawCardProps {
  slug: GameSlug;
  /** The newest draw in the snapshot, or null when there is no history to show. */
  draw: Draw | null;
  /** Generated data: say so on the card, so made-up numbers are never mistaken for a real result. */
  isSample?: boolean;
}

/** The previous winning combination, shown above the generator. */
export function LastDrawCard({ slug, draw, isSample = false }: LastDrawCardProps) {
  if (!draw) {
    return (
      <GlassCard className="p-4">
        <AppText tone="muted" className="text-sm">
          The last draw result is not available yet.
        </AppText>
      </GlassCard>
    );
  }

  const when = formatDate(draw.date);
  const drawLabel = draw.drawNumber ? `Draw ${draw.drawNumber}` : null;
  const spoken = [
    isSample ? 'Sample data, not a real result' : 'Last draw',
    when,
    drawLabel,
    `winning numbers ${draw.main.join(', ')}`,
    draw.supplementary.length > 0 ? `supplementary ${draw.supplementary.join(', ')}` : null,
    draw.powerball !== null ? `Powerball ${draw.powerball}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <GlassCard className="gap-3 p-4" accessible accessibilityLabel={spoken}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <AppText className="text-sm font-bold">{when}</AppText>
          {drawLabel && (
            <AppText tone="muted" className="text-xs">
              {drawLabel}
            </AppText>
          )}
        </View>
        {isSample && <Badge label="Sample · not real" tone="hot" />}
      </View>
      <BallRow
        slug={slug}
        main={draw.main}
        supplementary={draw.supplementary}
        powerball={draw.powerball}
        size={36}
      />
    </GlassCard>
  );
}
