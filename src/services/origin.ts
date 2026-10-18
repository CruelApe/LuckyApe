import { formatAge, formatDate } from '@shared/format';

import type { LoadedGame } from './gameData';

export interface OriginInfo {
  /** `warning` means the user is not looking at fresh, real results. */
  tone: 'positive' | 'warning';
  title: string;
  detail: string;
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
      detail: `Can't reach the data server. ${SAMPLE_NOTE} Start the scraper (see the README) for real results.`,
    };
  }
  if (origin === 'cached') {
    return {
      tone: 'warning',
      title: `Offline · saved ${formatAge(snapshot.fetchedAt, now)}`,
      detail: `${history}. Can't reach the data server, so this is the last copy kept on your device.`,
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
        detail: `The data server couldn't reach The Lott. ${SAMPLE_NOTE}`,
      };
  }
}
