import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { GeneratedTicket } from '@/lib';

export interface SavedTicket extends GeneratedTicket {
  savedAt: string;
}

export const MAX_SAVED_TICKETS = 200;

export interface TicketState {
  tickets: SavedTicket[];
  /** Saves a ticket (newest first). Returns false if it was already saved. Oldest tickets drop off at the cap. */
  save(ticket: GeneratedTicket): boolean;
  remove(id: string): void;
  clear(): void;
}

export function isSavedTicket(value: unknown): value is SavedTicket {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Partial<SavedTicket>;
  return (
    typeof t.id === 'string' &&
    typeof t.slug === 'string' &&
    typeof t.mode === 'string' &&
    typeof t.savedAt === 'string' &&
    Array.isArray(t.numbers) &&
    t.numbers.every((n) => typeof n === 'number') &&
    Array.isArray(t.badges)
  );
}

export const createTicketStore = (storage: StateStorage, now: () => Date = () => new Date()) =>
  create<TicketState>()(
    persist(
      (set, get) => ({
        tickets: [],
        save: (ticket) => {
          if (get().tickets.some((t) => t.id === ticket.id)) return false;
          const saved: SavedTicket = { ...ticket, savedAt: now().toISOString() };
          set((state) => ({ tickets: [saved, ...state.tickets].slice(0, MAX_SAVED_TICKETS) }));
          return true;
        },
        remove: (id) => set((state) => ({ tickets: state.tickets.filter((t) => t.id !== id) })),
        clear: () => set({ tickets: [] }),
      }),
      {
        name: 'luckyape:tickets',
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ tickets: state.tickets }),
        // Drop malformed entries instead of crashing the library screen on bad stored data.
        merge: (persisted, current) => {
          const stored = (persisted as Partial<TicketState> | undefined)?.tickets;
          return { ...current, tickets: Array.isArray(stored) ? stored.filter(isSavedTicket) : [] };
        },
      },
    ),
  );
