import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Defaults to a back chevron; modals pass a close icon. */
  backIcon?: LucideIcon;
  backLabel?: string;
  right?: ReactNode;
}

export function ScreenHeader({ title, subtitle, onBack, backIcon = ChevronLeft, backLabel = 'Go back', right }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center gap-3 pb-3">
      {onBack && <IconButton icon={backIcon} label={backLabel} onPress={onBack} />}
      <View className="flex-1">
        <AppText accessibilityRole="header" className="text-xl font-extrabold" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText tone="muted" className="text-xs" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}
