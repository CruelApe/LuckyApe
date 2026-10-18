import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { createThemeStore } from './theme';
import { createTicketStore } from './tickets';

export const useThemeStore = createThemeStore(AsyncStorage);
export const useTicketStore = createTicketStore(AsyncStorage);

export type { SavedTicket } from './tickets';

interface Persisted {
  persist: {
    hasHydrated(): boolean;
    onFinishHydration(listener: () => void): () => void;
  };
}

/** True once the store has finished loading from AsyncStorage. */
export function useHydrated(store: Persisted): boolean {
  return useSyncExternalStore(
    (onChange) => store.persist.onFinishHydration(onChange),
    () => store.persist.hasHydrated(),
    () => false,
  );
}
