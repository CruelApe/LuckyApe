/**
 * Colour tokens are CSS variables (space-separated RGB channels) injected at
 * runtime by <ThemeRoot /> from src/constants/theme.ts, so a single class like
 * `bg-surface` follows the Light / Dark toggle. Keep the keys below in sync
 * with `tokenNames` in src/constants/theme.ts (a unit test enforces this).
 */
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  // 'class' is what lets the in-app Light / Dark toggle drive NativeWind (see <ThemeRoot />);
  // the default 'media' only follows the device and throws on colorScheme.set().
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        surface: token('surface'),
        'surface-muted': token('surface-muted'),
        border: token('border'),
        fg: token('fg'),
        'fg-muted': token('fg-muted'),
        primary: token('primary'),
        'on-primary': token('on-primary'),
        accent: token('accent'),
        hot: token('hot'),
        cold: token('cold'),
        positive: token('positive'),
        danger: token('danger'),
      },
    },
  },
  plugins: [],
};
