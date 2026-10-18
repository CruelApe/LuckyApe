import { Flame, Layers, Repeat, Scale, Snowflake, type LucideIcon } from 'lucide-react-native';

import type { GeneratorMode, Strategy } from '@/lib';

export interface ModeInfo {
  id: GeneratorMode;
  label: string;
  icon: LucideIcon;
  /** What the mode does, in plain language — shown under the switcher. */
  description: string;
}

export const MODES: ModeInfo[] = [
  {
    id: 'hot',
    label: 'Hot',
    icon: Flame,
    description: 'Weights each number by how often it appeared recently. Frequent numbers are more likely to be chosen.',
  },
  {
    id: 'cold',
    label: 'Cold',
    icon: Snowflake,
    description: 'Inverse strategy: favours numbers that have been absent the longest and are rare overall ("overdue").',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    icon: Scale,
    description: 'Only keeps combinations with a typical odd/even split (e.g. 3:3 or 4:2), a historical sum range and no long runs.',
  },
  {
    id: 'bounce',
    label: 'Bounce',
    icon: Repeat,
    description: 'Carries up to two supplementary (or Powerball) numbers from the latest draws into the main set.',
  },
  {
    id: 'system',
    label: 'System',
    icon: Layers,
    description: 'Picks more numbers than a standard game (a System entry) that cover every combination of them.',
  },
];

export const STRATEGIES: { id: Strategy; label: string }[] = [
  { id: 'hot', label: 'Hot' },
  { id: 'cold', label: 'Cold' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'bounce', label: 'Bounce' },
];

export const modeLabel = (mode: GeneratorMode) => MODES.find((m) => m.id === mode)?.label ?? mode;
