import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { cn } from './cn';
import { useTheme } from './ThemeRoot';

interface IconButtonProps {
  icon: LucideIcon;
  /** Spoken by screen readers; required because the button has no visible text. */
  label: string;
  onPress: () => void;
  /** Small count shown on the corner, e.g. number of saved tickets. */
  badge?: number;
  filled?: boolean;
}

/** A 44×44 round icon button. */
export function IconButton({ icon: Icon, label, onPress, badge, filled = false }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      onPress={onPress}
      hitSlop={6}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-full border active:opacity-60',
        filled ? 'border-primary bg-primary' : 'border-border bg-surface/80',
      )}
    >
      <Icon size={20} color={filled ? colors['on-primary'] : colors.fg} />
      {badge ? (
        <View className="absolute -right-1 -top-1 min-w-[18px] items-center rounded-full bg-primary px-1">
          <AppText tone="onPrimary" className="text-[10px] font-bold">
            {badge > 99 ? '99+' : badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
