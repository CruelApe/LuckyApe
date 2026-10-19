import { formatAge, formatDate } from '@shared/format';

import type { LoadedGame } from './gameData';

export interface OriginInfo {
  /** `warning` means the user is not looking at fresh, real results. */
  tone: 'positive' | 'warning';
  title: string;
  detail: string;
}

export interface OriginBadgeInfo {
  kind: 'live' | 'imported' | 'saved' | 'sample';
  /** Short, upper-case text for the pill. */
  label: string;
  /** Spoken by screen readers, and fit for a sentence. */
  description: string;
}

/**
 * The at-a-glance version of `describeOrigin`, for a game's tile. Sample data wins over everything
 * so generated numbers can never wear a "live" badge, and a copy kept on the device is called what it is.
 */
export function originBadge({ snapshot, origin }: LoadedGame): OriginBadgeInfo {
  if (origin === 'offline' || snapshot.source === 'sample') {
    return { kind: 'sample', label: 'SAMPLE', description: 'Sample data, not real results' };
  }
  if (origin === 'cached') return { kind: 'saved', label: 'SAVED', description: 'Saved offline data' };
  if (snapshot.source === 'import') return { kind: 'imported', label: 'IMPORTED', description: 'Imported data' };
  return { kind: 'live', label: 'LIVE', description: 'Live data' };
}

const SAMPLE_NOTE = 'These draws are generated for illustration — they are not real results.';

/** Tells the user, honestly, what the numbers on screen are based on. */
export function describeOrigin(loaded: LoadedGame, now: Date = new Date()): OriginInfo {
  const { snapshot, origin } = loaded;
  const count = snapshot.draws.length;
  const latest = formatDate(snapshot.lastDrawDate ?? snapshot.draws[0]?.date ?? null);
  const history = count > 0 ? `${count} draws · latest ${latest}` : `Latest draw ${latest}`;

  if (origin === 'offline') {
    return {
      tone: 'warning',
      title: 'Sample data',
      detail: `Can't load live results right now. ${SAMPLE_NOTE} Check your internet connection and reopen the app.`,
    };
  }
  if (origin === 'cached') {
    return {
      tone: 'warning',
      title: `Offline · saved ${formatAge(snapshot.fetchedAt, now)}`,
      detail: `${history}. Can't reach The Lott, so this is the last copy kept on your device.`,
    };
  }
  switch (snapshot.source) {
    case 'thelott':
      return { tone: 'positive', title: 'Live from The Lott', detail: history };
    case 'import':
      return { tone: 'positive', title: 'Imported history', detail: history };
    case 'sample':
      return {
        tone: 'warning',
        title: 'Sample data',
        detail: `Live results weren't available. ${SAMPLE_NOTE}`,
      };
  }
}
