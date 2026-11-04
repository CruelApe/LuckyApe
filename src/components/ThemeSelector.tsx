import { Moon, Smartphone, Sun, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { ThemeMode } from '@/constants/theme';

import { AppText } from './AppText';
import { cn } from './cn';
import { useTheme } from './ThemeRoot';

const OPTIONS: readonly { mode: ThemeMode; label: string; icon: LucideIcon; description: string }[] = [
  { mode: 'light', label: 'Light', icon: Sun, description: 'Always use the light look.' },
  { mode: 'dark', label: 'Dark', icon: Moon, description: 'Always use the dark look.' },
  { mode: 'system', label: 'System', icon: Smartphone, description: 'Follow your phone’s light or dark setting.' },
];

/** Three-way Light | Dark | System choice, with a line saying what the selected one does. */
export function ThemeSelector() {
  const { mode, setMode, colors } = useTheme();
  const selected = OPTIONS.find((option) => option.mode === mode) ?? OPTIONS[2];

  return (
    <View className="gap-2">
      <View accessibilityRole="radiogroup" accessibilityLabel="Theme" className="flex-row gap-2">
        {OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => {
          const active = optionMode === selected.mode;
          return (
            <Pressable
              key={optionMode}
              accessibilityRole="radio"
              accessibilityLabel={`${label} theme`}
              accessibilityState={{ selected: active }}
              onPress={() => setMode(optionMode)}
              className={cn(
                'min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border px-2 active:opacity-70',
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
      </View>
      <AppText tone="muted" className="text-xs leading-4">
        {selected.description}
      </AppText>
    </View>
  );
}
