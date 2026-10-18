const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function parse(hex: string): [number, number, number] {
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) throw new Error(`Expected a #RRGGBB colour, got "${hex}"`);
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: number[]) => `#${rgb.map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** Blend towards white (amount 0..1). */
export function lighten(hex: string, amount: number): string {
  return toHex(parse(hex).map((v) => v + (255 - v) * amount));
}

/** Blend towards black (amount 0..1). */
export function darken(hex: string, amount: number): string {
  return toHex(parse(hex).map((v) => v * (1 - amount)));
}

/** Pick black-ish or white text for a background, by relative luminance. */
export function readableOn(hex: string): '#0F172A' | '#FFFFFF' {
  const [r, g, b] = parse(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0F172A' : '#FFFFFF';
}
