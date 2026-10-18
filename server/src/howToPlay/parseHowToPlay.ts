import * as cheerio from 'cheerio';

import type { Division, SystemRange } from '../../../shared/types';

/** Facts read from a The Lott "how to play" page. Every field is optional: absent means "not found". */
export interface ParsedRules {
  pick?: number;
  pool?: number;
  powerballPool?: number;
  system?: SystemRange;
  powerHitSystem?: SystemRange;
  divisions: Division[];
  /** The page's own statement of how many prize divisions there are. */
  declaredDivisions?: number;
}

/** Visible text of the page, whitespace-collapsed. Scripts and styles are dropped. */
export function pageText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, template').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

const toInt = (value: string) => Number(value.replace(/,/g, ''));

// "For a standard marked entry, choose 6 numbers from 1 to 45"
const CHOOSE_RE = /choose\s+(\d+)\s+numbers\s+from\s+(\d+)\s+to\s+(\d+)/i;
// "you need to select 7 numbers (between 1 and 35)"
const SELECT_RE = /select\s+(\d+)\s+numbers\s+\(between\s+(\d+)\s+and\s+(\d+)\)/i;
// "Choose a Powerball number from 1 to 20"
const POWERBALL_RE = /Powerball\s+number\s+from\s+(\d+)\s+to\s+(\d+)/i;
// "A System entry gives you ... You can choose from 7 to 20 numbers"
const SYSTEM_RE = /System entry[^.]*\.\s*You can choose from\s+(\d+)\s+to\s+(\d+)\s+numbers/i;
// "A PowerHit System entry ... allows you to pick from 8 to 15 numbers"
const POWERHIT_SYSTEM_RE = /PowerHit System entry[^.]*?pick from\s+(\d+)\s+to\s+(\d+)\s+numbers/i;
// "There are 6 TattsLotto prize divisions"
const DIVISION_COUNT_RE = /There are\s+(\d+)\s+[\w' ]{0,40}?prize divisions/i;
// "... Odds of winning (based on 1 standard game) are 8,145,060:1"
const ODDS_RE = /Odds of winning\s*\(based on 1 standard game\)\s*(?:are\s+)?([\d,]+)\s*:\s*1/gi;

function parseDivisions(text: string): Division[] {
  const matches = [...text.matchAll(ODDS_RE)];
  if (matches.length === 0) return [];

  // The first description follows the sentence that introduces the table.
  const firstStart = matches[0].index ?? 0;
  const intro = [...text.slice(0, firstStart).matchAll(/shown below\.?\s*/gi)].pop();
  let cursor = intro ? (intro.index ?? 0) + intro[0].length : Math.max(0, firstStart - 80);

  const divisions: Division[] = [];
  for (const match of matches) {
    const start = match.index ?? 0;
    // Descriptions are short phrases with no full stop; anything before the last sentence
    // break is page copy that happens to sit between two table entries.
    const description = (text.slice(cursor, start).split(/[.!?]\s+/).pop() ?? '').trim();
    cursor = start + match[0].length;
    const odds = toInt(match[1]);
    if (!/winning|supplementar|Powerball/i.test(description) || description.length > 120 || odds < 1) {
      continue;
    }
    divisions.push({ division: divisions.length + 1, match: description, oddsOneIn: odds });
  }
  return divisions;
}

export function parseHowToPlay(html: string): ParsedRules {
  const text = pageText(html);
  const parsed: ParsedRules = { divisions: parseDivisions(text) };

  const standard = text.match(CHOOSE_RE) ?? text.match(SELECT_RE);
  if (standard && toInt(standard[2]) === 1) {
    parsed.pick = toInt(standard[1]);
    parsed.pool = toInt(standard[3]);
  }

  const powerball = text.match(POWERBALL_RE);
  if (powerball && toInt(powerball[1]) === 1) parsed.powerballPool = toInt(powerball[2]);

  const system = text.match(SYSTEM_RE);
  if (system) parsed.system = { min: toInt(system[1]), max: toInt(system[2]) };

  const powerHit = text.match(POWERHIT_SYSTEM_RE);
  if (powerHit) parsed.powerHitSystem = { min: toInt(powerHit[1]), max: toInt(powerHit[2]) };

  const count = text.match(DIVISION_COUNT_RE);
  if (count) parsed.declaredDivisions = toInt(count[1]);

  return parsed;
}
