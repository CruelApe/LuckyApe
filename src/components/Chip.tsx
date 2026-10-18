import { Pressable } from 'react-native';

import { AppText } from './AppText';
import { cn } from './cn';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/** A compact single-choice pill. */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'min-h-10 items-center justify-center rounded-full border px-4 active:opacity-70',
        selected ? 'border-primary bg-primary' : 'border-border bg-surface/80',
      )}
    >
      <AppText tone={selected ? 'onPrimary' : 'default'} className="text-sm font-semibold">
        {label}
      </AppText>
    </Pressable>
  );
}
