import type { OpenDrawInfo } from '@shared/thelott';
import type { GameSlug, GameSnapshot } from '@shared/types';
import { describe, expect, it, vi } from 'vitest';

import type { LoadedGame } from './gameData';
import {
  DEFAULT_THRESHOLD_MILLIONS,
  MAX_THRESHOLD_MILLIONS,
  MIN_THRESHOLD_MILLIONS,
  alertNotificationData,
  clampThreshold,
  describeThreshold,
  evaluateJackpotAlerts,
  formatThreshold,
  gameSlugFromNotificationData,
  jackpotAlertMessage,
  readingsFromGames,
  readingsFromOpenDraws,
  runJackpotAlerts,
  type AlertRunDeps,
  type AlertSettings,
  type AlertedJackpots,
} from './jackpotAlerts';

const M = 1_000_000;

describe('clampThreshold', () => {
  it('keeps whole millions inside the allowed range', () => {
    expect(clampThreshold(50)).toBe(50);
    expect(clampThreshold(12.6)).toBe(13);
    expect(MIN_THRESHOLD_MILLIONS).toBe(0);
    expect(clampThreshold(0)).toBe(0);
    expect(clampThreshold(0.4)).toBe(0);
    expect(clampThreshold(-5)).toBe(0);
    expect(clampThreshold(9_999)).toBe(MAX_THRESHOLD_MILLIONS);
  });

  it('falls back to the default for values that are not numbers', () => {
    expect(clampThreshold(Number.NaN)).toBe(DEFAULT_THRESHOLD_MILLIONS);
    expect(clampThreshold(Number.POSITIVE_INFINITY)).toBe(DEFAULT_THRESHOLD_MILLIONS);
  });
});

describe('evaluateJackpotAlerts', () => {
  it('alerts for a jackpot at or above the amount, and remembers it', () => {
    const { alerts, alerted } = evaluateJackpotAlerts(
      [
        { slug: 'powerball', jackpot: 60 * M },
        { slug: 'oz-lotto', jackpot: 50 * M },
        { slug: 'tattslotto', jackpot: 20 * M },
      ],
      50,
      {},
    );
    expect(alerts).toEqual([
      { slug: 'powerball', jackpot: 60 * M },
      { slug: 'oz-lotto', jackpot: 50 * M },
    ]);
    expect(alerted).toEqual({ powerball: 60 * M, 'oz-lotto': 50 * M });
  });

  it('treats the amount as a minimum: $10M alerts at exactly $10M and above, never below', () => {
    const { alerts } = evaluateJackpotAlerts(
      [
        { slug: 'tattslotto', jackpot: 9_990_000 },
        { slug: 'oz-lotto', jackpot: 10 * M },
        { slug: 'powerball', jackpot: 12 * M },
      ],
      10,
      {},
    );
    expect(alerts.map((alert) => alert.slug)).toEqual(['oz-lotto', 'powerball']);
  });

  it('does not alert again while the jackpot stays up or grows', () => {
    const first = evaluateJackpotAlerts([{ slug: 'powerball', jackpot: 60 * M }], 50, {});
    const grown = evaluateJackpotAlerts([{ slug: 'powerball', jackpot: 70 * M }], 50, first.alerted);
    expect(grown.alerts).toEqual([]);
    expect(grown.alerted).toEqual({ powerball: 70 * M });

    const same = evaluateJackpotAlerts([{ slug: 'powerball', jackpot: 70 * M }], 50, grown.alerted);
    expect(same.alerts).toEqual([]);
  });

  it('re-arms when the jackpot falls below the amount, then alerts when it gets back', () => {
    const afterWin = evaluateJackpotAlerts([{ slug: 'powerball', jackpot: 3 * M }], 50, { powerball: 80 * M });
    expect(afterWin.alerts).toEqual([]);
    expect(afterWin.alerted).toEqual({});

    const backUp = evaluateJackpotAlerts([{ slug: 'powerball', jackpot: 55 * M }], 50, afterWin.alerted);
    expect(backUp.alerts).toEqual([{ slug: 'powerball', jackpot: 55 * M }]);
  });

  it('alerts again when a won jackpot restarts above a low amount', () => {
    // Amount $5M: the jackpot went $9M -> won -> $6M. Still above the amount, but a new run.
    const { alerts, alerted } = evaluateJackpotAlerts([{ slug: 'tattslotto', jackpot: 6 * M }], 5, { tattslotto: 9 * M });
    expect(alerts).toEqual([{ slug: 'tattslotto', jackpot: 6 * M }]);
    expect(alerted).toEqual({ tattslotto: 6 * M });
  });

  it('alerts a jackpot that is already above an amount that was just lowered', () => {
    const { alerts } = evaluateJackpotAlerts([{ slug: 'powerball', jackpot: 45 * M }], 30, {});
    expect(alerts).toEqual([{ slug: 'powerball', jackpot: 45 * M }]);
  });

  it('with the amount at 0, alerts on any known jackpot, then again each time one is won and restarts', () => {
    const first = evaluateJackpotAlerts(
      [
        { slug: 'tattslotto', jackpot: 4 * M },
        { slug: 'super-66', jackpot: 750_000 },
        { slug: 'powerball', jackpot: null },
      ],
      0,
      {},
    );
    expect(first.alerts.map((alert) => alert.slug)).toEqual(['tattslotto', 'super-66']);

    const grown = evaluateJackpotAlerts([{ slug: 'tattslotto', jackpot: 5 * M }], 0, first.alerted);
    expect(grown.alerts).toEqual([]);

    const afterWin = evaluateJackpotAlerts([{ slug: 'tattslotto', jackpot: 4 * M }], 0, grown.alerted);
    expect(afterWin.alerts).toEqual([{ slug: 'tattslotto', jackpot: 4 * M }]);
  });

  it('leaves a game alone when its jackpot is unknown', () => {
    const { alerts, alerted } = evaluateJackpotAlerts([{ slug: 'powerball', jackpot: null }], 50, { powerball: 80 * M });
    expect(alerts).toEqual([]);
    expect(alerted).toEqual({ powerball: 80 * M });
  });

  it('does not touch games it was not given a reading for, or mutate its input', () => {
    const before: AlertedJackpots = { 'oz-lotto': 70 * M };
    const { alerted } = evaluateJackpotAlerts([{ slug: 'powerball', jackpot: 60 * M }], 50, before);
    expect(alerted).toEqual({ 'oz-lotto': 70 * M, powerball: 60 * M });
    expect(before).toEqual({ 'oz-lotto': 70 * M });
  });
});

const snapshot = (slug: GameSlug, jackpot: number | null, source: GameSnapshot['source'] = 'thelott'): GameSnapshot =>
  ({ slug, jackpot, source }) as GameSnapshot;

describe('readings', () => {
  it('only trusts live, real data', () => {
    const games: LoadedGame[] = [
      { snapshot: snapshot('powerball', 60 * M), origin: 'live', error: null },
      { snapshot: snapshot('oz-lotto', 70 * M), origin: 'cached', error: 'offline' },
      { snapshot: snapshot('tattslotto', 80 * M, 'sample'), origin: 'offline', error: 'offline' },
      { snapshot: snapshot('super-66', 90 * M, 'sample'), origin: 'live', error: null },
    ];
    expect(readingsFromGames(games)).toEqual([{ slug: 'powerball', jackpot: 60 * M }]);
  });

  it('reads jackpots from open draws', () => {
    const open = new Map<GameSlug, OpenDrawInfo>([
      ['powerball', { jackpot: 60 * M, drawDays: ['Thursday'] }],
      ['oz-lotto', { jackpot: null, drawDays: ['Tuesday'] }],
    ]);
    expect(readingsFromOpenDraws(open)).toEqual([
      { slug: 'powerball', jackpot: 60 * M },
      { slug: 'oz-lotto', jackpot: null },
    ]);
  });
});

describe('jackpotAlertMessage', () => {
  it('names the game, the jackpot and the amount that was reached', () => {
    const message = jackpotAlertMessage({ slug: 'powerball', jackpot: 62_500_000 }, 50);
    expect(message.title).toContain('Powerball');
    expect(message.title).toContain('$62.5M');
    expect(message.body).toBe('It is at or above your $50M minimum.');
  });

  it('says so when the amount is "any jackpot"', () => {
    const message = jackpotAlertMessage({ slug: 'super-66', jackpot: 750_000 }, 0);
    expect(message.title).toContain('$750,000');
    expect(message.body).toBe('You chose to be alerted about any jackpot.');
  });
});

describe('describing the amount', () => {
  it('shows zero as "Any"', () => {
    expect(formatThreshold(0)).toBe('Any');
    expect(formatThreshold(5)).toBe('$5M');
    expect(formatThreshold(100)).toBe('$100M');
    expect(describeThreshold(0)).toBe('any jackpot');
    expect(describeThreshold(50)).toBe('$50M or more');
  });
});

describe('notification data', () => {
  it('carries the game so a tap can open it', () => {
    const data = alertNotificationData({ slug: 'oz-lotto', jackpot: 70 * M });
    expect(gameSlugFromNotificationData(data)).toBe('oz-lotto');
  });

  it('refuses data that is missing or not one of our games', () => {
    expect(gameSlugFromNotificationData(undefined)).toBeNull();
    expect(gameSlugFromNotificationData(null)).toBeNull();
    expect(gameSlugFromNotificationData('powerball')).toBeNull();
    expect(gameSlugFromNotificationData({})).toBeNull();
    expect(gameSlugFromNotificationData({ slug: 42 })).toBeNull();
    expect(gameSlugFromNotificationData({ slug: '../about' })).toBeNull();
  });
});

function harness(initial: Partial<AlertSettings> = {}) {
  const settings: AlertSettings = { enabled: true, thresholdMillions: 50, alerted: {}, ...initial };
  const notify = vi.fn<AlertRunDeps['notify']>().mockResolvedValue(undefined);
  const warn = vi.fn();
  const deps: AlertRunDeps = {
    getSettings: () => settings,
    saveAlerted: (alerted) => {
      settings.alerted = alerted;
    },
    notify,
    warn,
  };
  return { settings, notify, warn, deps };
}

describe('runJackpotAlerts', () => {
  it('does nothing while alerts are off', async () => {
    const { deps, notify, settings } = harness({ enabled: false });
    expect(await runJackpotAlerts([{ slug: 'powerball', jackpot: 99 * M }], deps)).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
    expect(settings.alerted).toEqual({});
  });

  it('notifies once per jackpot, however often the same data is checked', async () => {
    const { deps, notify } = harness();
    const readings = [{ slug: 'powerball' as const, jackpot: 60 * M }];
    expect(await runJackpotAlerts(readings, deps)).toEqual([{ slug: 'powerball', jackpot: 60 * M }]);
    expect(await runJackpotAlerts(readings, deps)).toEqual([]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({ slug: 'powerball', jackpot: 60 * M }, 50);
  });

  it('does not double-alert when two checks run at once', async () => {
    const { deps, notify } = harness();
    const readings = [{ slug: 'powerball' as const, jackpot: 60 * M }];
    await Promise.all([runJackpotAlerts(readings, deps), runJackpotAlerts(readings, deps)]);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('forgets an alert that could not be sent, so the next check retries it', async () => {
    const { deps, notify, warn, settings } = harness({ alerted: { 'oz-lotto': 70 * M } });
    notify.mockRejectedValueOnce(new Error('Notifications are not allowed'));
    const readings = [{ slug: 'powerball' as const, jackpot: 60 * M }];

    expect(await runJackpotAlerts(readings, deps)).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(settings.alerted).toEqual({ 'oz-lotto': 70 * M });

    expect(await runJackpotAlerts(readings, deps)).toEqual([{ slug: 'powerball', jackpot: 60 * M }]);
    expect(settings.alerted).toEqual({ 'oz-lotto': 70 * M, powerball: 60 * M });
  });

  it('keeps going when one notification fails', async () => {
    const { deps, notify } = harness();
    notify.mockRejectedValueOnce(new Error('boom'));
    const sent = await runJackpotAlerts(
      [
        { slug: 'powerball', jackpot: 60 * M },
        { slug: 'oz-lotto', jackpot: 70 * M },
      ],
      deps,
    );
    expect(sent).toEqual([{ slug: 'oz-lotto', jackpot: 70 * M }]);
  });
});
