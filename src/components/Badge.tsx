import type { BadgeTone } from '@/lib';
import { View } from 'react-native';

import { AppText, type Tone } from './AppText';
import { cn } from './cn';

const TONES: Record<BadgeTone, { box: string; text: Tone }> = {
  hot: { box: 'bg-hot/15', text: 'hot' },
  cold: { box: 'bg-cold/15', text: 'cold' },
  positive: { box: 'bg-positive/15', text: 'positive' },
  neutral: { box: 'bg-surface-muted', text: 'muted' },
};

/** A small rationale chip, e.g. "3 hot" or "Sum 138". */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const style = TONES[tone];
  return (
    <View className={cn('rounded-full px-2.5 py-1', style.box)}>
      <AppText tone={style.text} className="text-xs font-semibold">
        {label}
      </AppText>
    </View>
  );
}
