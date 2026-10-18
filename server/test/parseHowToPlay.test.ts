import { describe, expect, it } from 'vitest';

import { mergeRules } from '../src/howToPlay/mergeRules';
import { pageText, parseHowToPlay } from '../src/howToPlay/parseHowToPlay';
import { BUILTIN_RULES } from '../../shared/games';
import { fixture } from './helpers';

describe('pageText', () => {
  it('drops scripts, styles and collapses whitespace', () => {
    const text = pageText('<body><script>alert(1)</script><style>p{}</style><p>a\n\n  b</p></body>');
    expect(text).toBe('a b');
  });
});

describe('parseHowToPlay', () => {
  it('reads TattsLotto: pick/pool, system range and every division', () => {
    const parsed = parseHowToPlay(fixture('how-to-play-tattslotto.html'));
    expect(parsed).toMatchObject({ pick: 6, pool: 45, system: { min: 7, max: 20 }, declaredDivisions: 6 });
    expect(parsed.powerballPool).toBeUndefined();
    expect(parsed.divisions).toEqual(BUILTIN_RULES.tattslotto.divisions);
  });

  it('ignores numbers that only appear inside scripts', () => {
    expect(parseHowToPlay(fixture('how-to-play-tattslotto.html')).pool).toBe(45);
  });

  it('reads Powerball: the second barrel, system and PowerHit system ranges', () => {
    const parsed = parseHowToPlay(fixture('how-to-play-powerball.html'));
    expect(parsed).toMatchObject({
      pick: 7,
      pool: 35,
      powerballPool: 20,
      system: { min: 8, max: 20 },
      powerHitSystem: { min: 8, max: 15 },
      declaredDivisions: 9,
    });
    expect(parsed.divisions).toHaveLength(9);
    expect(parsed.divisions[0]).toEqual({
      division: 1,
      match: '7 winning numbers + the Powerball number',
      oddsOneIn: 134_490_400,
    });
    expect(parsed.divisions[6]).toMatchObject({ division: 7, match: '5 winning numbers', oddsOneIn: 892 });
  });

  it('reads the "select N numbers (between A and B)" phrasing and survives garbled intro copy', () => {
    const parsed = parseHowToPlay(fixture('how-to-play-oz-lotto.html'));
    expect(parsed).toMatchObject({ pick: 7, pool: 47, system: { min: 8, max: 20 } });
    expect(parsed.divisions).toHaveLength(7);
    expect(parsed.divisions[0].match).toBe('7 winning numbers');
    expect(parsed.divisions[0].oddsOneIn).toBe(62_891_499);
  });

  it('returns nothing (rather than guessing) for a page it does not understand', () => {
    expect(parseHowToPlay('<body><p>Raffle style. Numbers are allocated.</p></body>')).toEqual({ divisions: [] });
  });

  it('does not treat a range that starts above 1 as a number pool', () => {
    expect(parseHowToPlay('<p>choose 3 numbers from 5 to 20</p>').pool).toBeUndefined();
  });
});

describe('mergeRules', () => {
  const tatts = BUILTIN_RULES.tattslotto;

  it('confirms the built-in rules when the page agrees', () => {
    const result = mergeRules(tatts, parseHowToPlay(fixture('how-to-play-tattslotto.html')));
    expect(result.source).toBe('scraped');
    expect(result.changes).toEqual([]);
    expect(result.rules).toEqual(tatts);
  });

  it('applies and reports changes the site has made', () => {
    const result = mergeRules(tatts, { pick: 6, pool: 45, system: { min: 7, max: 18 }, divisions: [] });
    expect(result.rules.system).toEqual({ min: 7, max: 18 });
    expect(result.changes).toEqual(['system entries: 7–20 -> 7–18']);
  });

  it('adopts a changed main pool', () => {
    const result = mergeRules(tatts, { pick: 6, pool: 50, divisions: [] });
    expect(result.rules.main).toEqual({ pick: 6, pool: 50 });
    expect(result.changes[0]).toMatch(/6 of 45 -> 6 of 50/);
  });

  it('ignores divisions whose Division 1 odds contradict the rules', () => {
    const divisions = [{ division: 1, match: '6 winning numbers', oddsOneIn: 123 }];
    const result = mergeRules(tatts, { pick: 6, pool: 45, divisions });
    expect(result.rules.divisions).toEqual(tatts.divisions);
    expect(result.changes.join()).toMatch(/Division 1 odds 123/);
  });

  it('ignores divisions when the page declares a different count', () => {
    const parsed = parseHowToPlay(fixture('how-to-play-tattslotto.html'));
    const result = mergeRules(tatts, { ...parsed, declaredDivisions: 7 });
    expect(result.rules.divisions).toEqual(tatts.divisions);
    expect(result.changes.join()).toMatch(/page says 7 but 6/);
  });

  it('keeps built-in values when parsed values are invalid', () => {
    const result = mergeRules(tatts, {
      pick: 50,
      pool: 45,
      system: { min: 30, max: 10 },
      divisions: [],
    });
    expect(result.source).toBe('builtin');
    expect(result.rules).toEqual(tatts);
  });

  it('reports builtin when nothing was parsed', () => {
    expect(mergeRules(tatts, { divisions: [] }).source).toBe('builtin');
  });

  it('takes draw days from the live API when they differ', () => {
    const result = mergeRules(tatts, { divisions: [] }, ['Monday', 'Saturday']);
    expect(result.rules.drawDays).toEqual(['Monday', 'Saturday']);
    expect(result.changes).toEqual(['draw days: Saturday -> Monday/Saturday']);
  });

  it('leaves allocated games alone apart from draw days', () => {
    const super66 = BUILTIN_RULES['super-66'];
    const result = mergeRules(super66, { pick: 6, pool: 45, divisions: [] }, ['Saturday']);
    expect(result.rules).toEqual(super66);
    expect(result.source).toBe('builtin');
  });
});
