import { describe, expect, it } from 'vitest';

import { formatAge, formatDate, formatInt, formatJackpot, formatOdds } from './format';

describe('formatInt', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1,000'],
    [8_145_060, '8,145,060'],
    [134_490_400, '134,490,400'],
  ])('%i -> %s', (value, expected) => expect(formatInt(value)).toBe(expected));
});

describe('formatJackpot', () => {
  it.each([
    [null, '—'],
    [155_000, '$155,000'],
    [500_000, '$500,000'],
    [1_000_000, '$1M'],
    [1_720_003, '$1.72M'],
    [6_000_000, '$6M'],
    [40_000_000, '$40M'],
    [12_500_000, '$12.5M'],
  ])('%s -> %s', (value, expected) => expect(formatJackpot(value)).toBe(expected));
});

describe('formatDate', () => {
  it('formats an ISO date with its weekday', () => {
    expect(formatDate('2026-10-17')).toBe('Sat 17 Oct 2026');
    expect(formatDate('2026-01-01')).toBe('Thu 1 Jan 2026');
    expect(formatDate('2026-10-17T00:00:00')).toBe('Sat 17 Oct 2026');
  });
  it('shows a dash for missing or malformed dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('17/10/2026')).toBe('—');
  });
});

describe('formatAge', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  it.each([
    ['2026-10-18T11:59:50Z', 'just now'],
    ['2026-10-18T11:30:00Z', '30 min ago'],
    ['2026-10-18T09:00:00Z', '3 h ago'],
    ['2026-10-15T12:00:00Z', '3 d ago'],
    ['2026-10-19T12:00:00Z', 'just now'], // clock skew never produces a negative age
  ])('%s -> %s', (iso, expected) => expect(formatAge(iso, now)).toBe(expected));
});

describe('formatOdds', () => {
  it('reads naturally', () => expect(formatOdds(678_755)).toBe('1 in 678,755'));
});
