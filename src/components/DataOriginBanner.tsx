import { Database, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import type { LoadedGame } from '@/services/gameData';
import { describeOrigin } from '@/services/origin';

import { AppText } from './AppText';
import { cn } from './cn';
import { useTheme } from './ThemeRoot';

/** States plainly whether the numbers on screen are live, saved, or generated sample data. */
export function DataOriginBanner({ loaded }: { loaded: LoadedGame }) {
  const { colors } = useTheme();
  const info = describeOrigin(loaded);
  const warning = info.tone === 'warning';
  const Icon = warning ? TriangleAlert : Database;
  return (
    <View
      accessible
      accessibilityLabel={`${info.title}. ${info.detail}`}
      className={cn(
        'flex-row items-start gap-3 rounded-2xl border px-3.5 py-3',
        warning ? 'border-hot/40 bg-hot/10' : 'border-positive/30 bg-positive/10',
      )}
    >
      <Icon size={18} color={warning ? colors.hot : colors.positive} style={{ marginTop: 1 }} />
      <View className="flex-1">
        <AppText tone={warning ? 'hot' : 'positive'} className="text-sm font-bold">
          {info.title}
        </AppText>
        <AppText tone="muted" className="text-xs leading-4">
          {info.detail}
        </AppText>
      </View>
    </View>
  );
}
