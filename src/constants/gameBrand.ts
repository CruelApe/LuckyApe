import type { GameSlug } from '@shared/types';
import {
  Compass,
  CalendarDays,
  Crown,
  Gem,
  Hash,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

import { readableOn } from './colors';

export type BallKind = 'main' | 'supplementary' | 'bonus';

export interface BallStyle {
  background: string;
  text: string;
}

export interface GameBrand {
  /** Card accent, ball highlight and header tint. */
  accent: string;
  icon: LucideIcon;
  /** One line shown under the name on the selector card. */
  blurb: string;
  balls: Record<BallKind, BallStyle>;
}

const ball = (background: string): BallStyle => ({ background, text: readableOn(background) });

/**
 * Colours are Lucky Ape's own interpretation of each game's look — they are not The Lott's
 * official artwork and make no claim to be.
 */
export const GAME_BRAND: Record<GameSlug, GameBrand> = {
  tattslotto: {
    accent: '#DC2626',
    icon: Trophy,
    blurb: '6 from 45',
    balls: { main: ball('#DC2626'), supplementary: ball('#2563EB'), bonus: ball('#2563EB') },
  },
  'weekday-windfall': {
    accent: '#059669',
    icon: CalendarDays,
    blurb: '6 from 45 · Mon, Wed, Fri',
    balls: { main: ball('#059669'), supplementary: ball('#64748B'), bonus: ball('#64748B') },
  },
  'oz-lotto': {
    accent: '#1D4ED8',
    icon: Compass,
    blurb: '7 from 47',
    balls: { main: ball('#1D4ED8'), supplementary: ball('#F59E0B'), bonus: ball('#F59E0B') },
  },
  powerball: {
    accent: '#EAB308',
    icon: Zap,
    blurb: '7 from 35 + Powerball',
    balls: { main: ball('#FACC15'), supplementary: ball('#DC2626'), bonus: ball('#DC2626') },
  },
  'lucky-lotteries-super': {
    accent: '#7C3AED',
    icon: Gem,
    blurb: 'Raffle · numbers allocated',
    balls: { main: ball('#7C3AED'), supplementary: ball('#A78BFA'), bonus: ball('#A78BFA') },
  },
  'lucky-lotteries-mega': {
    accent: '#DB2777',
    icon: Crown,
    blurb: 'Raffle · numbers allocated',
    balls: { main: ball('#DB2777'), supplementary: ball('#F472B6'), bonus: ball('#F472B6') },
  },
  'super-66': {
    accent: '#EA580C',
    icon: Hash,
    blurb: '6 digits · QuickPick only',
    balls: { main: ball('#EA580C'), supplementary: ball('#FDBA74'), bonus: ball('#FDBA74') },
  },
};
