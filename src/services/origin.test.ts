import { BUILTIN_RULES } from '@shared/games';
import { generateSampleSnapshot } from '@shared/sample';
import type { GameSnapshot } from '@shared/types';
import { describe, expect, it } from 'vitest';

import type { LoadedGame, SnapshotOrigin } from './gameData';
import { originBadge } from './origin';

const NOW = new Date('2026-10-18T12:00:00Z');
const loaded = (origin: SnapshotOrigin, source: GameSnapshot['source']): LoadedGame => ({
  snapshot: { ...generateSampleSnapshot(BUILTIN_RULES.tattslotto, { now: NOW, draws: 5 }), source },
  origin,
  error: origin === 'live' ? null : 'down',
});

describe('originBadge', () => {
  it('says LIVE for fresh results from The Lott', () => {
    expect(originBadge(loaded('live', 'thelott'))).toMatchObject({ kind: 'live', label: 'LIVE' });
  });

  it('says SAMPLE for generated data, however it arrived', () => {
    expect(originBadge(loaded('offline', 'sample'))).toMatchObject({ kind: 'sample', label: 'SAMPLE' });
    expect(originBadge(loaded('live', 'sample'))).toMatchObject({ kind: 'sample', label: 'SAMPLE' });
    expect(originBadge(loaded('cached', 'sample'))).toMatchObject({ kind: 'sample', label: 'SAMPLE' });
  });

  it('never calls a copy kept on the device LIVE', () => {
    expect(originBadge(loaded('cached', 'thelott'))).toMatchObject({ kind: 'saved', label: 'SAVED' });
  });

  it('keeps imported history distinct from live results', () => {
    expect(originBadge(loaded('live', 'import'))).toMatchObject({ kind: 'imported', label: 'IMPORTED' });
  });

  it('has a spoken description for every state', () => {
    const cases: [SnapshotOrigin, GameSnapshot['source']][] = [
      ['live', 'thelott'],
      ['cached', 'thelott'],
      ['offline', 'sample'],
      ['live', 'import'],
    ];
    for (const [origin, source] of cases) expect(originBadge(loaded(origin, source)).description).toMatch(/data/i);
  });
});
