import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BUILTIN_RULES } from '../../shared/games';
import { ImportError, loadImportedDraws, parseCsvDraws, parseJsonDraws } from '../src/sources/fileImport';

const tatts = BUILTIN_RULES.tattslotto;
const powerball = BUILTIN_RULES.powerball;

describe('parseCsvDraws', () => {
  const csv = [
    '# my own export',
    'date,draw,n1,n2,n3,n4,n5,n6,s1,s2',
    '2026-10-10,4719,16,41,15,2,33,43,28,5',
    '',
    '2026-10-17,4721,32,11,22,30,15,1,43,13',
  ].join('\n');

  it('reads draws in file order, sorting the numbers within each draw', () => {
    const draws = parseCsvDraws(csv, tatts, 'tattslotto.csv');
    expect(draws).toHaveLength(2);
    expect(draws[1]).toEqual({ drawNumber: 4721, date: '2026-10-17', main: [1, 11, 15, 22, 30, 32], supplementary: [13, 43], powerball: null });
  });

  it('is case-insensitive about headers and does not care about column order', () => {
    const text = 'S2,N6,N1,DATE,S1,N3,N2,N5,N4\n8,6,1,2026-01-01,7,3,2,5,4';
    const [draw] = parseCsvDraws(text, tatts, 'x.csv');
    expect(draw).toMatchObject({ date: '2026-01-01', main: [1, 2, 3, 4, 5, 6], supplementary: [7, 8] });
  });

  it('reads a Powerball column', () => {
    const text = 'date,n1,n2,n3,n4,n5,n6,n7,powerball\n2026-10-15,14,24,15,3,27,32,30,16';
    const [draw] = parseCsvDraws(text, powerball, 'powerball.csv');
    expect(draw).toMatchObject({ powerball: 16, supplementary: [], main: [3, 14, 15, 24, 27, 30, 32] });
  });

  it('names the file and line of a bad row', () => {
    const bad = csv.replace('16,41,15,2,33,43', '16,41,15,2,33,99');
    expect(() => parseCsvDraws(bad, tatts, '/data/tattslotto.csv')).toThrow('tattslotto.csv: line 3 is not a valid TattsLotto draw');
  });

  it('rejects files without a date column, number columns, or rows', () => {
    expect(() => parseCsvDraws('n1,n2\n1,2', tatts, 'f.csv')).toThrow(/"date" column/);
    expect(() => parseCsvDraws('date,x\n2026-01-01,1', tatts, 'f.csv')).toThrow(/n1, n2/);
    expect(() => parseCsvDraws('date,n1', tatts, 'f.csv')).toThrow(/at least one draw/);
  });
});

describe('parseJsonDraws', () => {
  const draw = { drawNumber: 1, date: '2026-10-17', main: [1, 11, 15, 22, 30, 32], supplementary: [13, 43], powerball: null };

  it('accepts a bare array or { draws: [...] }', () => {
    expect(parseJsonDraws(JSON.stringify([draw]), tatts, 'f.json')).toHaveLength(1);
    expect(parseJsonDraws(JSON.stringify({ draws: [draw] }), tatts, 'f.json')).toHaveLength(1);
  });

  it('rejects bad JSON, wrong shapes and invalid draws', () => {
    expect(() => parseJsonDraws('{nope', tatts, 'f.json')).toThrow(/invalid JSON/);
    expect(() => parseJsonDraws('{"a":1}', tatts, 'f.json')).toThrow(/array of draws/);
    expect(() => parseJsonDraws(JSON.stringify([{ ...draw, main: [1, 2] }]), tatts, 'f.json')).toThrow(/draws\[0\]/);
  });
});

describe('loadImportedDraws', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'luckyape-import-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null when there is no file for the game', async () => {
    expect(await loadImportedDraws(dir, tatts)).toBeNull();
    expect(await loadImportedDraws(path.join(dir, 'does-not-exist'), tatts)).toBeNull();
  });

  it('prefers JSON, falls back to CSV', async () => {
    await writeFile(
      path.join(dir, 'tattslotto.csv'),
      'date,n1,n2,n3,n4,n5,n6,s1,s2\n2026-10-10,1,2,3,4,5,6,7,8\n2026-10-17,1,2,3,4,5,9,7,8',
    );
    const fromCsv = await loadImportedDraws(dir, tatts);
    expect(fromCsv?.map((d) => d.date)).toEqual(['2026-10-17', '2026-10-10']); // newest first
    const json = [
      { drawNumber: 1, date: '2026-10-10', main: [1, 2, 3, 4, 5, 6], supplementary: [7, 8], powerball: null },
      { drawNumber: 2, date: '2026-10-17', main: [1, 2, 3, 4, 5, 9], supplementary: [7, 8], powerball: null },
    ];
    await writeFile(path.join(dir, 'tattslotto.json'), JSON.stringify(json));
    expect(await loadImportedDraws(dir, tatts)).toHaveLength(2);
  });

  it('lets a corrupt file raise instead of silently falling through', async () => {
    await writeFile(path.join(dir, 'tattslotto.json'), 'not json');
    await expect(loadImportedDraws(dir, tatts)).rejects.toBeInstanceOf(ImportError);
  });
});
