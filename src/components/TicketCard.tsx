import { BookmarkCheck, Bookmark, Share2 } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { modeLabel } from '@/constants/modes';
import type { GeneratedTicket } from '@/lib';
import { ticketToText } from '@/lib';
import { shareText } from '@/services/share';

import { AppText } from './AppText';
import { Badge } from './Badge';
import { BallRow } from './BallRow';
import { GlassCard } from './GlassCard';
import { useTheme } from './ThemeRoot';

interface TicketCardProps {
  ticket: GeneratedTicket;
  gameName: string;
  saved: boolean;
  onToggleSave: () => void;
  /** Pop the balls in (used for freshly generated tickets). */
  animate?: boolean;
  /** 1-based position, for the "Combination 2" heading. */
  index?: number;
}

/** A generated combination: balls in the game's colours, statistical rationale badges, save and share. */
export function TicketCard({ ticket, gameName, saved, onToggleSave, animate = false, index }: TicketCardProps) {
  const { colors } = useTheme();
  const title = ticket.system
    ? `System ${ticket.system.size}${ticket.system.powerHit ? ' · PowerHit' : ''} · ${modeLabel(ticket.basedOn ?? 'hot')}`
    : modeLabel(ticket.mode);
  // Size the balls so a standard ticket fits one row on a phone; big systems wrap, which is fine.
  const ballCount = ticket.numbers.length + (ticket.powerball !== null ? 1 : 0);
  const ballSize = ballCount <= 6 ? 40 : ballCount <= 8 ? 32 : 30;

  return (
    <GlassCard className="gap-3 p-4">
      <View className="flex-row items-center justify-between">
        <AppText tone="muted" className="text-xs font-bold uppercase tracking-wider">
          {index ? `#${index} · ` : ''}
          {title}
        </AppText>
        <AppText tone="muted" className="text-[11px]">
          {ticket.drawsAnalysed} draws
        </AppText>
      </View>

      <BallRow slug={ticket.slug} main={ticket.numbers} powerball={ticket.powerball} size={ballSize} animate={animate} />

      {ticket.system?.powerHit && (
        <AppText tone="muted" className="text-xs">
          PowerHit: the winning Powerball is guaranteed, so no Powerball is chosen.
        </AppText>
      )}

      <View className="flex-row flex-wrap gap-1.5">
        {ticket.badges.map((badge) => (
          <Badge key={badge.id} label={badge.label} tone={badge.tone} />
        ))}
      </View>

      <View className="flex-row gap-2 border-t border-border pt-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved tickets' : 'Save combination'}
          accessibilityState={{ selected: saved }}
          onPress={onToggleSave}
          className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-surface-muted active:opacity-60"
        >
          {saved ? <BookmarkCheck size={17} color={colors.positive} /> : <Bookmark size={17} color={colors.fg} />}
          <AppText tone={saved ? 'positive' : 'default'} className="text-sm font-semibold">
            {saved ? 'Saved' : 'Save'}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share combination"
          onPress={() => shareText(ticketToText(ticket, gameName))}
          className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-surface-muted active:opacity-60"
        >
          <Share2 size={17} color={colors.fg} />
          <AppText className="text-sm font-semibold">Share</AppText>
        </Pressable>
      </View>
    </GlassCard>
  );
}
