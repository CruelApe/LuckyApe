/**
 * The splash screen's progress model: where the bar is, and what it says, for each phase of
 * start-up. Pure so the numbers can be tested; the splash screen just reports phases.
 */
export type PreloadPhase =
  | { kind: 'init' }
  | { kind: 'fetch'; done: number; total: number; game: string }
  | { kind: 'analyze'; done: number; total: number; game: string }
  | { kind: 'done'; offline: boolean };

const FETCH_START = 10;
const FETCH_END = 85;
const ANALYZE_END = 99;

const lerp = (from: number, to: number, fraction: number) => from + (to - from) * fraction;

/** Whole-number percentage, never going backwards between phases and reaching 100 only when done. */
export function preloadPercent(phase: PreloadPhase): number {
  switch (phase.kind) {
    case 'init':
      return 4;
    case 'fetch':
      return Math.round(lerp(FETCH_START, FETCH_END, phase.done / phase.total));
    case 'analyze':
      return Math.min(ANALYZE_END, Math.round(lerp(FETCH_END, ANALYZE_END, phase.done / phase.total)));
    case 'done':
      return 100;
  }
}

export function preloadLabel(phase: PreloadPhase): string {
  const pct = preloadPercent(phase);
  switch (phase.kind) {
    case 'init':
      return `Warming up the jungle… ${pct}%`;
    case 'fetch':
      return `Loading latest draw history… ${pct}%`;
    case 'analyze':
      return `Calculating probability distributions… ${pct}%`;
    case 'done':
      return phase.offline ? 'Ready — using saved data · 100%' : 'Ready · 100%';
  }
}
