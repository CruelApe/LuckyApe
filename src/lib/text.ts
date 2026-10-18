import { formatInt } from '@shared/format';
import { combinations } from '@shared/math';
import type { GameRules } from '@shared/types';

import type { GeneratedTicket } from './types';

/** One-line summary of how a game is played, built from the (possibly scraped) rules. */
export function describeRules(rules: GameRules): string {
  if (rules.slug === 'super-66') return '6 digits (0–9) · QuickPick only';
  if (rules.kind === 'allocated' || !rules.main) return 'Raffle · numbers allocated';
  const parts = [`Pick ${rules.main.pick} from ${rules.main.pool}`];
  if (rules.powerball) parts.push(`+ Powerball (1–${rules.powerball.pool})`);
  return parts.join(' ');
}

/** ["Monday","Wednesday","Friday"] -> "Monday, Wednesday and Friday" */
export function joinDays(days: string[]): string {
  if (days.length <= 1) return days[0] ?? '';
  return `${days.slice(0, -1).join(', ')} and ${days.at(-1)}`;
}

/**
 * Plain-language "how to play" steps, generated from the same rules the generator enforces so the
 * rules screen can never disagree with the numbers it produces. Facts only, in our own words.
 */
export function howToPlaySteps(rules: GameRules): string[] {
  if (rules.slug === 'super-66') {
    return [
      'Super 66 is QuickPick only: six digits (0–9) are allocated for you, one per barrel.',
      'Prizes need consecutive digits matched in the exact order drawn, from the start or the end.',
      rules.drawDays.length ? `Drawn ${joinDays(rules.drawDays)} night.` : '',
    ].filter(Boolean);
  }
  if (rules.kind === 'allocated' || !rules.main) {
    return [rules.allocatedNote ?? 'Numbers for this game are allocated for you.'];
  }

  const { pick, pool } = rules.main;
  const steps = [
    `Choose ${pick} numbers from 1 to ${pool}${rules.powerball ? `, plus 1 Powerball number from 1 to ${rules.powerball.pool}` : ''}.`,
  ];
  if (rules.supplementaries > 0) {
    steps.push(
      `${rules.supplementaries} supplementary numbers are drawn after the ${pick} main numbers; they count towards some lower divisions.`,
    );
  }
  if (rules.powerball) {
    steps.push(`The Powerball is drawn from its own barrel of ${rules.powerball.pool} balls.`);
  }
  if (rules.drawDays.length > 0) steps.push(`Drawn ${joinDays(rules.drawDays)}.`);
  if (rules.system) {
    const { min, max } = rules.system;
    steps.push(
      `System entries let you choose ${min}–${max} numbers and cover every ${pick}-number combination of them — ${min} numbers is ${formatInt(combinations(min, pick))} games, ${max} numbers is ${formatInt(combinations(max, pick))}.`,
    );
  }
  if (rules.powerHitSystem) {
    steps.push(
      `PowerHit guarantees the winning Powerball number; a PowerHit System lets you choose ${rules.powerHitSystem.min}–${rules.powerHitSystem.max} main numbers.`,
    );
  }
  return steps;
}

/** Plain-text version of a ticket for the share sheet. */
export function ticketToText(ticket: GeneratedTicket, gameName: string): string {
  const numbers = ticket.numbers.join(' ');
  const lines = [`${gameName} — ${ticket.system ? `System ${ticket.system.size}` : 'Standard'} entry`, numbers];
  if (ticket.powerball !== null) lines.push(`Powerball: ${ticket.powerball}`);
  if (ticket.system?.powerHit) lines.push('PowerHit (Powerball guaranteed)');
  if (ticket.system) lines.push(`Covers ${formatInt(ticket.system.games)} standard games`);
  lines.push('— Lucky Ape · a statistical tool, not a prediction');
  return lines.join('\n');
}
