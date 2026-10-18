import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { AppText } from './AppText';
import { cn } from './cn';
import { useTheme } from './ThemeRoot';

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
  accessibilityHint?: string;
}

export function Button({ label, onPress, icon: Icon, variant = 'primary', accessibilityHint }: ButtonProps) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      className={cn(
        'min-h-12 flex-row items-center justify-center gap-2 rounded-full px-6 active:opacity-70',
        primary ? 'bg-primary' : 'border border-border bg-surface/80',
      )}
    >
      {Icon && <Icon size={18} color={primary ? colors['on-primary'] : colors.fg} />}
      <AppText tone={primary ? 'onPrimary' : 'default'} className="text-base font-bold">
        {label}
      </AppText>
    </Pressable>
  );
}
