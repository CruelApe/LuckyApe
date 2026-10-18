import { describe, expect, it } from 'vitest';

import { BUILTIN_RULES } from '../../shared/games';
import { UpstreamError } from '../src/http';
import {
  DRAW_RANGE_SPAN,
  TheLottApi,
  mergeDraws,
  normalizeDraw,
  normalizeDraws,
  type RawDraw,
} from '../src/sources/thelottApi';
import { apiFailure, fakeHttp, fixtureJson, testConfig } from './helpers';

const tatts = BUILTIN_RULES.tattslotto;
const raw = (overrides: Partial<RawDraw> = {}): RawDraw => ({
  ProductId: 'TattsLotto',
  DrawNumber: 1,
  DrawDate: '2026-10-17T00:00:00',
  PrimaryNumbers: [32, 11, 22, 30, 15, 1],
  SecondaryNumbers: [43, 13],
  ...overrides,
});

describe('normalizeDraw (real captured responses)', () => {
  it('TattsLotto: sorts main numbers and supplementaries, keeps the ISO date', () => {
    const [first] = fixtureJson('latest-TattsLotto.json').DrawResults;
    expect(normalizeDraw(tatts, first)).toEqual({
      drawNumber: 4721,
      date: '2026-10-17',
      main: [1, 11, 15, 22, 30, 32],
      supplementary: [13, 43],
      powerball: null,
    });
  });

  it('Weekday Windfall and Oz Lotto: supplementary counts follow the rules', () => {
    const ww = normalizeDraw(BUILTIN_RULES['weekday-windfall'], fixtureJson('latest-MondayWednesdayFridayLotto.json').DrawResults[0]);
    expect(ww?.main).toHaveLength(6);
    expect(ww?.supplementary).toHaveLength(2);
    const oz = normalizeDraw(BUILTIN_RULES['oz-lotto'], fixtureJson('latest-OzLotto.json').DrawResults[0]);
    expect(oz?.main).toHaveLength(7);
    expect(oz?.supplementary).toHaveLength(3);
  });

  it('Powerball: the single secondary number is the Powerball, not a supplementary', () => {
    const pb = normalizeDraw(BUILTIN_RULES.powerball, fixtureJson('latest-Powerball.json').DrawResults[0]);
    expect(pb).toEqual({
      drawNumber: 1587,
      date: '2026-10-15',
      main: [3, 14, 15, 24, 27, 30, 32],
      supplementary: [],
      powerball: 16,
    });
  });

  it('Super 66: keeps the six digits in drawn order', () => {
    const s66 = normalizeDraw(BUILTIN_RULES['super-66'], fixtureJson('latest-Super66.json').DrawResults[0]);
    expect(s66?.main).toEqual([9, 0, 0, 5, 9, 0]);
  });

  it('has no model for raffle draws', () => {
    const raffle = fixtureJson('latest-LuckyLotteries2.json').DrawResults[0];
    expect(normalizeDraw(BUILTIN_RULES['lucky-lotteries-super'], raffle)).toBeNull();
  });
});

describe('normalizeDraw validation', () => {
  it.each([
    ['too few numbers', { PrimaryNumbers: [1, 2, 3, 4, 5] }],
    ['a number outside the pool', { PrimaryNumbers: [1, 2, 3, 4, 5, 46] }],
    ['zero', { PrimaryNumbers: [0, 2, 3, 4, 5, 6] }],
    ['duplicates', { PrimaryNumbers: [1, 1, 3, 4, 5, 6] }],
    ['non-integers', { PrimaryNumbers: [1.5, 2, 3, 4, 5, 6] }],
    ['wrong supplementary count', { SecondaryNumbers: [43] }],
    ['a supplementary outside the pool', { SecondaryNumbers: [43, 99] }],
    ['an unparseable date', { DrawDate: '17/10/2026' }],
    ['missing numbers', { PrimaryNumbers: null }],
  ])('rejects %s', (_label, overrides) => {
    expect(normalizeDraw(tatts, raw(overrides as Partial<RawDraw>))).toBeNull();
  });

  it('rejects a Powerball draw without exactly one in-range Powerball', () => {
    const pb = BUILTIN_RULES.powerball;
    const base = { ProductId: 'Powerball', DrawNumber: 1, DrawDate: '2026-10-15T00:00:00', PrimaryNumbers: [1, 2, 3, 4, 5, 6, 7] };
    expect(normalizeDraw(pb, { ...base, SecondaryNumbers: [21] })).toBeNull();
    expect(normalizeDraw(pb, { ...base, SecondaryNumbers: [] })).toBeNull();
    expect(normalizeDraw(pb, { ...base, SecondaryNumbers: [3, 4] })).toBeNull();
    expect(normalizeDraw(pb, { ...base, SecondaryNumbers: [20] })?.powerball).toBe(20);
  });

  it('rejects Super 66 digits outside 0-9', () => {
    const s66 = BUILTIN_RULES['super-66'];
    const base = { DrawNumber: 1, DrawDate: '2026-10-17T00:00:00', SecondaryNumbers: [] };
    expect(normalizeDraw(s66, { ...base, PrimaryNumbers: [1, 2, 3, 4, 5, 10] })).toBeNull();
    expect(normalizeDraw(s66, { ...base, PrimaryNumbers: [0, 0, 0, 0, 0, 0] })?.main).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('normalizeDraws', () => {
  it('drops the odd bad draw but refuses a batch that is mostly wrong (API shape changed)', () => {
    const good = raw();
    const bad = raw({ PrimaryNumbers: [1, 2] });
    expect(normalizeDraws(tatts, [good, good, bad], 'url')).toHaveLength(2);
    expect(() => normalizeDraws(tatts, [good, bad, bad], 'url')).toThrow(UpstreamError);
    expect(normalizeDraws(tatts, [], 'url')).toEqual([]);
  });
});

describe('mergeDraws', () => {
  it('de-duplicates by draw number and sorts newest first', () => {
    const a = normalizeDraw(tatts, raw({ DrawNumber: 3, DrawDate: '2026-10-03T00:00:00' }))!;
    const b = normalizeDraw(tatts, raw({ DrawNumber: 5, DrawDate: '2026-10-10T00:00:00' }))!;
    const merged = mergeDraws([a], [b, a]);
    expect(merged.map((d) => d.drawNumber)).toEqual([5, 3]);
  });
});

/** A fake Lott with `total` TattsLotto draws numbered downwards in steps of 2, like the real product. */
function fakeLott(total: number, newest = 4721) {
  const all: RawDraw[] = Array.from({ length: total }, (_, i) => {
    const n = newest - i * 2;
    const date = new Date(Date.UTC(2026, 9, 17) - i * 7 * 86_400_000).toISOString().slice(0, 19);
    return raw({ DrawNumber: n, DrawDate: date, PrimaryNumbers: [1 + (n % 5), 10, 20, 30, 40, 45 - (n % 3)], SecondaryNumbers: [2, 3] });
  });
  const rangeCalls: { min: number; max: number }[] = [];
  const http = fakeHttp({
    post: (url, body) => {
      if (url.endsWith('latestresults')) return { Success: true, DrawResults: all.slice(0, body.MaxDrawCountPerProduct) };
      if (url.endsWith('drawrange')) {
        if (body.MaxDrawNo - body.MinDrawNo + 1 > DRAW_RANGE_SPAN) return apiFailure('Draw range exceeds the 50 draws limit.');
        rangeCalls.push({ min: body.MinDrawNo, max: body.MaxDrawNo });
        return { Success: true, Draws: all.filter((d) => d.DrawNumber! >= body.MinDrawNo && d.DrawNumber! <= body.MaxDrawNo) };
      }
      throw new Error(`unexpected ${url}`);
    },
  });
  return { http, rangeCalls, all };
}

describe('TheLottApi', () => {
  it('asks for the latest draws of one product with the request shape the site uses', async () => {
    const http = fakeHttp({ post: () => fixtureJson('latest-TattsLotto.json') });
    const draws = await new TheLottApi(http, testConfig()).fetchLatest(tatts, 500);
    expect(draws).toHaveLength(3);
    expect(http.calls[0].url).toBe('https://data.api.thelott.com/sales/vmax/web/data/lotto/latestresults');
    expect(http.calls[0].body).toEqual({
      CompanyId: 'Tattersalls',
      OptionalProductFilter: ['TattsLotto'],
      MaxDrawCountPerProduct: 10, // capped: the API never returns more
    });
  });

  it('ignores draws that belong to other products', async () => {
    const http = fakeHttp({ post: () => ({ Success: true, DrawResults: [raw(), raw({ ProductId: 'OzLotto' })] }) });
    expect(await new TheLottApi(http, testConfig()).fetchLatest(tatts)).toHaveLength(1);
  });

  it('surfaces API-level failures with the API message', async () => {
    const http = fakeHttp({ post: () => apiFailure('Draw range exceeds the 50 draws limit.') });
    await expect(new TheLottApi(http, testConfig()).fetchDrawRange(tatts, 4672, 4721)).rejects.toThrow(
      /50 draws limit/,
    );
  });

  it('never asks for a draw range wider than the API allows', async () => {
    const http = fakeHttp({ post: () => ({}) });
    await expect(new TheLottApi(http, testConfig()).fetchDrawRange(tatts, 1, 60)).rejects.toThrow(RangeError);
    expect(http.calls).toHaveLength(0);
  });

  it('parses a real drawrange response', async () => {
    const http = fakeHttp({ post: () => fixtureJson('drawrange-TattsLotto.json') });
    const draws = await new TheLottApi(http, testConfig()).fetchDrawRange(tatts, 4672, 4721);
    expect(draws.map((d) => d.drawNumber)).toEqual([4721, 4719, 4717, 4715]);
    expect(http.calls[0].body).toEqual({ MinDrawNo: 4672, MaxDrawNo: 4721, Product: 'TattsLotto', CompanyFilter: ['Tattersalls'] });
  });

  describe('fetchHistory', () => {
    it('pages backwards in windows of at most 50 draw numbers until it has enough', async () => {
      const { http, rangeCalls, all } = fakeLott(400);
      const draws = await new TheLottApi(http, testConfig()).fetchHistory(tatts, 100);
      expect(draws).toHaveLength(100);
      expect(new Set(draws.map((d) => d.drawNumber)).size).toBe(100);
      expect(draws.map((d) => d.drawNumber)).toEqual(all.slice(0, 100).map((d) => d.DrawNumber));
      expect(rangeCalls).toHaveLength(4); // 10 latest + 4 windows of 25 draws (step-2 numbering)
      expect(rangeCalls.every((c) => c.max - c.min + 1 <= DRAW_RANGE_SPAN)).toBe(true);
      // windows are contiguous: each starts right below the previous one
      for (let i = 1; i < rangeCalls.length; i++) expect(rangeCalls[i].max).toBe(rangeCalls[i - 1].min - 1);
    });

    it('stops after a few empty windows instead of looping forever', async () => {
      const { http, rangeCalls } = fakeLott(10);
      const draws = await new TheLottApi(http, testConfig()).fetchHistory(tatts, 100);
      expect(draws).toHaveLength(10);
      expect(rangeCalls).toHaveLength(2);
    });

    it('needs only the latest request when the new draws join up with what we already hold', async () => {
      const { http, all } = fakeLott(400);
      const api = new TheLottApi(http, testConfig());
      const known = (await api.fetchHistory(tatts, 100)).slice(2); // pretend we missed the two newest draws
      http.calls.length = 0;
      const refreshed = await api.fetchHistory(tatts, 100, known);
      expect(http.calls.map((c) => c.url.split('/').pop())).toEqual(['latestresults']);
      expect(refreshed).toHaveLength(100);
      expect(refreshed[0].drawNumber).toBe(all[0].DrawNumber);
    });
  });

  describe('fetchOpenDraws', () => {
    const open = () => fakeHttp({ post: () => fixtureJson('opendraws.json') });

    it('reads each game\'s next jackpot and its draw days', async () => {
      const http = open();
      const info = await new TheLottApi(http, testConfig()).fetchOpenDraws(Object.keys(BUILTIN_RULES) as never);
      expect(info.get('tattslotto')).toEqual({ jackpot: 6_000_000, drawDays: ['Saturday'] });
      expect(info.get('oz-lotto')).toEqual({ jackpot: 40_000_000, drawDays: ['Tuesday'] });
      expect(info.get('powerball')).toEqual({ jackpot: 10_000_000, drawDays: ['Thursday'] });
      expect(info.get('weekday-windfall')).toEqual({ jackpot: 1_000_000, drawDays: ['Monday', 'Wednesday', 'Friday'] });
      expect(info.get('super-66')?.jackpot).toBe(155_000);
      expect(info.get('lucky-lotteries-super')).toEqual({ jackpot: 500_000, drawDays: [] });
      expect(http.calls[0].body.MaxDrawCount).toBe(20);
    });

    it('treats an unknown jackpot as null, never as the placeholder value', async () => {
      const data = fixtureJson('opendraws.json');
      for (const d of data.Draws) if (d.ProductId === 'TattsLotto') d.IsDiv1Unknown = true;
      const http = fakeHttp({ post: () => data });
      const info = await new TheLottApi(http, testConfig()).fetchOpenDraws(['tattslotto']);
      expect(info.get('tattslotto')?.jackpot).toBeNull();
    });

    it('uses the earliest upcoming draw for the jackpot', async () => {
      const data = fixtureJson('opendraws.json');
      data.Draws.reverse(); // order in the response must not matter
      const http = fakeHttp({ post: () => data });
      const info = await new TheLottApi(http, testConfig()).fetchOpenDraws(['oz-lotto']);
      expect(info.get('oz-lotto')?.jackpot).toBe(40_000_000); // 20 Oct, not the 27 Oct draw with unknown Div 1
    });
  });
});
