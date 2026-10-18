import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameSlug, GameSnapshot } from '@shared/types';

import { isGameSnapshot } from './api';

const key = (slug: GameSlug) => `luckyape:snapshot:v1:${slug}`;

/** Last good snapshot for a game, or null if there is none (or it is unreadable). */
export async function readCachedSnapshot(slug: GameSlug): Promise<GameSnapshot | null> {
  const raw = await AsyncStorage.getItem(key(slug));
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isGameSnapshot(parsed, slug) ? parsed : null;
  } catch (cause) {
    throw new Error(`Cached ${slug} data is corrupt`, { cause });
  }
}

export async function writeCachedSnapshot(snapshot: GameSnapshot): Promise<void> {
  // Sample data is never worth keeping: it is regenerated on demand and must not look like a cache of real results.
  if (snapshot.source === 'sample') return;
  await AsyncStorage.setItem(key(snapshot.slug), JSON.stringify(snapshot));
}
