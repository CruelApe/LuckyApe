import { View } from 'react-native';

import type { OriginBadgeInfo } from '@/services/origin';

import { AppText, type Tone } from './AppText';
import { cn } from './cn';

const STYLE: Record<OriginBadgeInfo['kind'], { box: string; dot: string | null; text: Tone }> = {
  live: { box: 'bg-positive/15', dot: 'bg-positive', text: 'positive' },
  imported: { box: 'bg-positive/15', dot: null, text: 'positive' },
  saved: { box: 'bg-surface-muted', dot: null, text: 'muted' },
  sample: { box: 'bg-hot/15', dot: null, text: 'hot' },
};

/** A small pill saying whether a game's numbers are live, saved on the device, imported or generated sample data. */
export function OriginBadge({ info }: { info: OriginBadgeInfo }) {
  const style = STYLE[info.kind];
  return (
    <View
      accessible
      accessibilityLabel={info.description}
      className={cn('flex-row items-center gap-1 rounded-full px-2 py-0.5', style.box)}
    >
      {style.dot && <View className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />}
      <AppText tone={style.text} className="text-[10px] font-bold">
        {info.label}
      </AppText>
    </View>
  );
}
