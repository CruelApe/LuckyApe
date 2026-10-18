import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Draw, GameRules } from '../../../shared/types';
import { mergeDraws, normalizeDraw, type RawDraw } from './thelottApi';

export class ImportError extends Error {
  constructor(message: string, readonly file: string) {
    super(`${path.basename(file)}: ${message}`);
    this.name = 'ImportError';
  }
}

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function toRaw(draw: Draw): RawDraw {
  return {
    DrawNumber: draw.drawNumber ?? undefined,
    DrawDate: draw.date,
    PrimaryNumbers: draw.main,
    SecondaryNumbers: draw.powerball !== null ? [draw.powerball] : draw.supplementary,
  };
}

function validate(rules: GameRules, raw: RawDraw, where: string, file: string): Draw {
  const draw = normalizeDraw(rules, raw);
  if (!draw) {
    throw new ImportError(`${where} is not a valid ${rules.name} draw (check the date, count and range of numbers)`, file);
  }
  return draw;
}

export function parseJsonDraws(text: string, rules: GameRules, file: string): Draw[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    throw new ImportError(`invalid JSON (${(cause as Error).message})`, file);
  }
  const list = Array.isArray(data) ? data : (data as { draws?: unknown })?.draws;
  if (!Array.isArray(list)) {
    throw new ImportError('expected a JSON array of draws, or an object with a "draws" array', file);
  }
  return list.map((item, index) => validate(rules, toRaw(item as Draw), `draws[${index}]`, file));
}

/**
 * CSV with a header row. Recognised columns (case-insensitive):
 * `date` (YYYY-MM-DD), `draw` (optional number), `n1..nK` (main numbers),
 * `s1..sM` (supplementaries), `powerball` (Powerball only).
 */
export function parseCsvDraws(text: string, rules: GameRules, file: string): Draw[] {
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line !== '' && !line.startsWith('#'));
  if (lines.length < 2) throw new ImportError('needs a header row and at least one draw', file);

  const header = lines[0].line.split(',').map((h) => h.trim().toLowerCase());
  const column = (name: string) => header.indexOf(name);
  const numbered = (prefix: string) =>
    header
      .map((name, index) => ({ name, index }))
      .filter(({ name }) => new RegExp(`^${prefix}\\d+$`).test(name))
      .sort((a, b) => Number(a.name.slice(prefix.length)) - Number(b.name.slice(prefix.length)))
      .map(({ index }) => index);

  const dateColumn = column('date');
  if (dateColumn < 0) throw new ImportError('missing a "date" column', file);
  const mainColumns = numbered('n');
  if (mainColumns.length === 0) throw new ImportError('missing main number columns n1, n2, ...', file);
  const suppColumns = numbered('s');
  const drawColumn = column('draw');
  const powerballColumn = column('powerball');

  return lines.slice(1).map(({ line, number }) => {
    const cells = line.split(',').map((c) => c.trim());
    const num = (index: number) => (cells[index] === undefined || cells[index] === '' ? NaN : Number(cells[index]));
    const raw: RawDraw = {
      DrawNumber: drawColumn >= 0 && cells[drawColumn] ? num(drawColumn) : undefined,
      DrawDate: cells[dateColumn],
      PrimaryNumbers: mainColumns.map(num),
      SecondaryNumbers:
        powerballColumn >= 0 ? [num(powerballColumn)] : suppColumns.map(num).filter((n) => !Number.isNaN(n)),
    };
    return validate(rules, raw, `line ${number}`, file);
  });
}

/**
 * Look for `<dir>/<slug>.json` then `<dir>/<slug>.csv`. Returns null when neither exists,
 * so callers can fall through to the next source.
 */
export async function loadImportedDraws(dir: string, rules: GameRules): Promise<Draw[] | null> {
  const jsonFile = path.join(dir, `${rules.slug}.json`);
  const csvFile = path.join(dir, `${rules.slug}.csv`);
  const json = await readIfExists(jsonFile);
  if (json !== null) return mergeDraws(parseJsonDraws(json, rules, jsonFile));
  const csv = await readIfExists(csvFile);
  if (csv !== null) return mergeDraws(parseCsvDraws(csv, rules, csvFile));
  return null;
}
