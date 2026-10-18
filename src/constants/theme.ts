export type Scheme = 'light' | 'dark';
export type ThemeMode = 'system' | Scheme;

/**
 * Every colour the UI uses. Keep in sync with `colors` in tailwind.config.js — a unit test
 * checks both lists match, so `bg-<token>` classes can never silently lose their colour.
 */
export const tokenNames = [
  'background',
  'surface',
  'surface-muted',
  'border',
  'fg',
  'fg-muted',
  'primary',
  'on-primary',
  'accent',
  'hot',
  'cold',
  'positive',
  'danger',
] as const;

export type TokenName = (typeof tokenNames)[number];
type Rgb = readonly [number, number, number];

/** Slate surfaces with banana-amber as the brand colour; dark background is #0F172A. */
export const palettes: Record<Scheme, Record<TokenName, Rgb>> = {
  dark: {
    background: [15, 23, 42],
    surface: [30, 41, 59],
    'surface-muted': [51, 65, 85],
    border: [51, 65, 85],
    fg: [241, 245, 249],
    'fg-muted': [148, 163, 184],
    primary: [251, 191, 36],
    'on-primary': [15, 23, 42],
    accent: [167, 139, 250],
    hot: [251, 146, 60],
    cold: [56, 189, 248],
    positive: [52, 211, 153],
    danger: [248, 113, 113],
  },
  light: {
    background: [248, 250, 252],
    surface: [255, 255, 255],
    'surface-muted': [241, 245, 249],
    border: [226, 232, 240],
    fg: [15, 23, 42],
    'fg-muted': [100, 116, 139],
    primary: [245, 158, 11],
    'on-primary': [15, 23, 42],
    accent: [109, 40, 217],
    hot: [234, 88, 12],
    cold: [2, 132, 199],
    positive: [5, 150, 105],
    danger: [220, 38, 38],
  },
};

/** CSS variables in the "r g b" form Tailwind's `rgb(var(--x) / <alpha>)` expects. */
export function cssVars(scheme: Scheme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const name of tokenNames) vars[`--color-${name}`] = palettes[scheme][name].join(' ');
  return vars;
}

const hex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** Hex colours for props that cannot take a className (icon `color`, status bar, navigation theme). */
export function colorsFor(scheme: Scheme): Record<TokenName, string> {
  return Object.fromEntries(tokenNames.map((name) => [name, hex(palettes[scheme][name])])) as Record<
    TokenName,
    string
  >;
}

/** Same colour with alpha, for the few places a hex value needs transparency. */
export function withAlpha(color: Rgb | string, alpha: number): string {
  const [r, g, b] =
    typeof color === 'string'
      ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
      : color;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
