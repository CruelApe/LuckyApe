import { Pressable, ScrollView, View } from 'react-native';

import { MODES } from '@/constants/modes';
import type { GeneratorMode } from '@/lib';

import { AppText } from './AppText';
import { cn } from './cn';
import { useTheme } from './ThemeRoot';

interface ModeSelectorProps {
  value: GeneratorMode;
  onChange: (mode: GeneratorMode) => void;
  /** Hide modes that do not apply (e.g. System on a game without system entries). */
  available?: GeneratorMode[];
}

/** Segmented algorithm switcher, with a plain-language description of the selected one. */
export function ModeSelector({ value, onChange, available }: ModeSelectorProps) {
  const { colors } = useTheme();
  const modes = MODES.filter((m) => !available || available.includes(m.id));
  const selected = modes.find((m) => m.id === value) ?? modes[0];

  return (
    <View className="gap-3">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" accessibilityRole="tablist">
        {modes.map(({ id, label, icon: Icon }) => {
          const active = id === selected.id;
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityLabel={`${label} mode`}
              accessibilityState={{ selected: active }}
              onPress={() => onChange(id)}
              className={cn(
                'min-h-11 flex-row items-center gap-2 rounded-full border px-4 active:opacity-70',
                active ? 'border-primary bg-primary' : 'border-border bg-surface/80',
              )}
            >
              <Icon size={16} color={active ? colors['on-primary'] : colors.fg} />
              <AppText tone={active ? 'onPrimary' : 'default'} className="text-sm font-bold">
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      <AppText tone="muted" className="text-xs leading-4">
        {selected.description}
      </AppText>
    </View>
  );
}
