import { Text, type TextProps } from 'react-native';

import { cn } from './cn';

export type Tone = 'default' | 'muted' | 'primary' | 'onPrimary' | 'accent' | 'hot' | 'cold' | 'positive' | 'danger';

// One colour class per element: NativeWind resolves conflicting utilities by stylesheet order,
// not by order in the string, so colour must only ever come from here.
const TONE_CLASS: Record<Tone, string> = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  primary: 'text-primary',
  onPrimary: 'text-on-primary',
  accent: 'text-accent',
  hot: 'text-hot',
  cold: 'text-cold',
  positive: 'text-positive',
  danger: 'text-danger',
};

interface AppTextProps extends TextProps {
  tone?: Tone;
  /** Size, weight and spacing only — never a text colour (use `tone`). */
  className?: string;
}

export function AppText({ tone = 'default', className, ...props }: AppTextProps) {
  return <Text className={cn(TONE_CLASS[tone], className)} {...props} />;
}
