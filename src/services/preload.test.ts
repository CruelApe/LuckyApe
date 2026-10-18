import { describe, expect, it } from 'vitest';

import { preloadLabel, preloadPercent, type PreloadPhase } from './preload';
import { darken, lighten, readableOn } from '../constants/colors';

const TOTAL = 7;

/** The phases in the order the splash screen reports them for a full start-up. */
const sequence = (): PreloadPhase[] => [
  { kind: 'init' },
  ...Array.from({ length: TOTAL }, (_, i): PreloadPhase => ({ kind: 'fetch', done: i + 1, total: TOTAL, game: 'g' })),
  ...Array.from({ length: TOTAL }, (_, i): PreloadPhase => ({ kind: 'analyze', done: i + 1, total: TOTAL, game: 'g' })),
  { kind: 'done', offline: false },
];

describe('preloadPercent', () => {
  it('only ever moves forward through a full start-up', () => {
    const values = sequence().map(preloadPercent);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  });

  it('reaches exactly 100 only when finished', () => {
    const all = sequence();
    expect(preloadPercent(all.at(-1)!)).toBe(100);
    expect(all.slice(0, -1).every((p) => preloadPercent(p) < 100)).toBe(true);
  });

  it('hits the documented waypoints', () => {
    expect(preloadPercent({ kind: 'fetch', done: 0, total: 7, game: 'g' })).toBe(10);
    expect(preloadPercent({ kind: 'fetch', done: 7, total: 7, game: 'g' })).toBe(85);
    expect(preloadPercent({ kind: 'analyze', done: 7, total: 7, game: 'g' })).toBe(99);
  });

  it('stays within 0..100', () => {
    for (const phase of sequence()) {
      const pct = preloadPercent(phase);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });
});

describe('preloadLabel', () => {
  it('names the phase and shows the percentage, matching the bar', () => {
    const fetch: PreloadPhase = { kind: 'fetch', done: 3, total: 7, game: 'Oz Lotto' };
    expect(preloadLabel(fetch)).toBe(`Loading latest draw history… ${preloadPercent(fetch)}%`);
    const analyze: PreloadPhase = { kind: 'analyze', done: 6, total: 7, game: 'Oz Lotto' };
    expect(preloadLabel(analyze)).toMatch(/^Calculating probability distributions… 9\d%$/);
  });

  it('tells the user when it is running from saved data', () => {
    expect(preloadLabel({ kind: 'done', offline: true })).toMatch(/saved data/);
    expect(preloadLabel({ kind: 'done', offline: false })).toBe('Ready · 100%');
  });
});

describe('colour helpers', () => {
  it('lighten and darken blend towards white and black', () => {
    expect(lighten('#000000', 0.5)).toBe('#808080');
    expect(darken('#FFFFFF', 0.5)).toBe('#808080');
    expect(lighten('#123456', 0)).toBe('#123456');
    expect(darken('#123456', 1)).toBe('#000000');
  });

  it('picks readable text for ball colours', () => {
    expect(readableOn('#FACC15')).toBe('#0F172A'); // Powerball yellow needs dark text
    expect(readableOn('#DC2626')).toBe('#FFFFFF'); // TattsLotto red needs white text
    expect(readableOn('#F59E0B')).toBe('#0F172A');
  });

  it('rejects malformed colours', () => {
    expect(() => lighten('red', 0.1)).toThrow(/#RRGGBB/);
  });
});
