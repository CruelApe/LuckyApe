import { Minus, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { Chip } from './Chip';
import { cn } from './cn';
import { useTheme } from './ThemeRoot';

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Extra line under the label, e.g. "= 38,760 games". */
  hint?: string;
  /** Shortcuts to jump straight to a value, for ranges too long to tap through one step at a time. */
  presets?: readonly number[];
}

/** A labelled −/+ control with clamped bounds and spoken value. */
export function Stepper({ label, value, min, max, onChange, hint, presets }: StepperProps) {
  const { colors } = useTheme();
  const step = (delta: number) => onChange(Math.max(min, Math.min(max, value + delta)));
  const button = (delta: -1 | 1, disabled: boolean) => {
    const Icon = delta < 0 ? Minus : Plus;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${delta < 0 ? 'Decrease' : 'Increase'} ${label}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => step(delta)}
        className={cn(
          'h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/80 active:opacity-60',
          disabled && 'opacity-35',
        )}
      >
        <Icon size={18} color={colors.fg} />
      </Pressable>
    );
  };

  const shortcuts = (presets ?? []).filter((preset) => preset >= min && preset <= max);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <AppText className="text-sm font-semibold">{label}</AppText>
          {hint ? (
            <AppText tone="muted" className="text-xs">
              {hint}
            </AppText>
          ) : null}
        </View>
        <View className="flex-row items-center gap-3">
          {button(-1, value <= min)}
          <AppText
            accessibilityRole="adjustable"
            accessibilityValue={{ min, max, now: value }}
            className="min-w-8 text-center text-xl font-extrabold"
          >
            {value}
          </AppText>
          {button(1, value >= max)}
        </View>
      </View>
      {shortcuts.length > 0 && (
        <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel={`${label} shortcuts`}>
          {shortcuts.map((preset) => (
            <Chip key={preset} label={String(preset)} selected={value === preset} onPress={() => onChange(preset)} />
          ))}
        </View>
      )}
    </View>
  );
}
