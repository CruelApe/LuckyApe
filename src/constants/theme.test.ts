import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { colorsFor, cssVars, palettes, tokenNames, withAlpha } from './theme';

const tailwindConfig = readFileSync(path.join(__dirname, '..', '..', 'tailwind.config.js'), 'utf8');

describe('theme tokens', () => {
  it('are all declared in tailwind.config.js (and nothing else is)', () => {
    const block = tailwindConfig.match(/colors:\s*\{([\s\S]*?)\n\s*\},/)?.[1] ?? '';
    const declared = [...block.matchAll(/['"]?([a-z-]+)['"]?:\s*token\('([a-z-]+)'\)/g)].map((m) => {
      expect(m[1], 'colour key must match its token() argument').toBe(m[2]);
      return m[1];
    });
    expect(declared.sort()).toEqual([...tokenNames].sort());
  });

  it('are defined for both schemes with valid RGB channels', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const name of tokenNames) {
        const rgb = palettes[scheme][name];
        expect(rgb, `${scheme}.${name}`).toHaveLength(3);
        expect(rgb.every((c) => Number.isInteger(c) && c >= 0 && c <= 255)).toBe(true);
      }
    }
  });

  it('use the specified dark slate background', () => {
    expect(colorsFor('dark').background).toBe('#0F172A');
  });

  it('expose css variables in the space-separated form Tailwind expects', () => {
    const vars = cssVars('dark');
    expect(Object.keys(vars)).toHaveLength(tokenNames.length);
    expect(vars['--color-background']).toBe('15 23 42');
    expect(vars['--color-on-primary']).toBe('15 23 42');
  });

  it('keep text legible: foreground vs background contrast is at least 7:1 in both schemes', () => {
    const luminance = ([r, g, b]: readonly number[]) => {
      const [R, G, B] = [r, g, b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    };
    const contrast = (a: readonly number[], b: readonly number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const scheme of ['light', 'dark'] as const) {
      const p = palettes[scheme];
      expect(contrast(p.fg, p.background), `${scheme} fg/background`).toBeGreaterThanOrEqual(7);
      expect(contrast(p['on-primary'], p.primary), `${scheme} on-primary/primary`).toBeGreaterThanOrEqual(7);
      expect(contrast(p['fg-muted'], p.background), `${scheme} fg-muted/background`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('withAlpha', () => {
  it('accepts hex strings and rgb tuples', () => {
    expect(withAlpha('#FF8000', 0.5)).toBe('rgba(255, 128, 0, 0.5)');
    expect(withAlpha([1, 2, 3], 0.25)).toBe('rgba(1, 2, 3, 0.25)');
  });
});
