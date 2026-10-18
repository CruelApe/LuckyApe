import { BUILTIN_RULES } from '@shared/games';
import { useRouter } from 'expo-router';
import { Bookmark, Trash2 } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TicketCard } from '@/components/TicketCard';
import { useTheme } from '@/components/ThemeRoot';
import { confirm } from '@/services/dialog';
import { useTicketStore } from '@/store';

/** The saved-ticket library. */
export function SavedTicketsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const tickets = useTicketStore((s) => s.tickets);
  const remove = useTicketStore((s) => s.remove);
  const clear = useTicketStore((s) => s.clear);

  const clearAll = async () => {
    const ok = await confirm('Clear saved tickets?', `This removes all ${tickets.length} saved combinations from this device.`, 'Clear all');
    if (ok) clear();
  };

  return (
    <Screen
      header={
        <ScreenHeader
          title="Saved tickets"
          subtitle={tickets.length ? `${tickets.length} saved on this device` : undefined}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/games'))}
          right={tickets.length > 0 ? <IconButton icon={Trash2} label="Clear all saved tickets" onPress={clearAll} /> : undefined}
        />
      }
    >
      {tickets.length === 0 ? (
        <GlassCard className="mt-4 items-center gap-3 p-8">
          <Bookmark size={32} color={colors['fg-muted']} />
          <AppText className="text-base font-extrabold">Nothing saved yet</AppText>
          <AppText tone="muted" className="text-center text-sm">
            Tap Save on any generated combination and it will be kept here, even after you close the app.
          </AppText>
          <Button label="Browse games" variant="secondary" onPress={() => router.replace('/games')} />
        </GlassCard>
      ) : (
        <View className="gap-3">
          {tickets.map((ticket) => (
            <View key={ticket.id} className="gap-1.5">
              <AppText tone="muted" className="px-1 text-xs">
                {BUILTIN_RULES[ticket.slug].name} · saved {ticket.savedAt.slice(0, 10)}
              </AppText>
              <TicketCard
                ticket={ticket}
                gameName={BUILTIN_RULES[ticket.slug].name}
                saved
                onToggleSave={() => remove(ticket.id)}
              />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
