import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { useTheme } from './ThemeRoot';

interface CollapsibleSectionProps {
  title: string;
  /** One line shown under the title while collapsed (and expanded), so the header still says something. */
  summary?: string;
  /** Starts collapsed unless told otherwise, to keep the screen focused on what matters. */
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A card whose header toggles its body. The header is a single large touch target with expanded state for screen readers. */
export function CollapsibleSection({ title, summary, defaultOpen = false, children }: CollapsibleSectionProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <View className="mt-6">
      <GlassCard>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}${summary ? `. ${summary}` : ''}`}
          accessibilityHint={open ? 'Double tap to collapse' : 'Double tap to expand'}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((current) => !current)}
          className="min-h-14 flex-row items-center justify-between gap-3 px-4 py-3 active:opacity-60"
        >
          <View className="flex-1">
            <AppText className="text-lg font-extrabold">{title}</AppText>
            {summary ? (
              <AppText tone="muted" className="text-xs">
                {summary}
              </AppText>
            ) : null}
          </View>
          <Chevron size={22} color={colors['fg-muted']} />
        </Pressable>
      </GlassCard>
      {open && <View className="mt-3">{children}</View>}
    </View>
  );
}
