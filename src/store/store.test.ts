import { describe, expect, it } from 'vitest';
import type { StateStorage } from 'zustand/middleware';

import type { GeneratedTicket } from '@/lib';

import { createThemeStore } from './theme';
import { MAX_SAVED_TICKETS, createTicketStore } from './tickets';

function memoryStorage(initial: Record<string, string> = {}): StateStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const ticket = (id: string, numbers = [1, 2, 3, 4, 5, 6]): GeneratedTicket => ({
  id,
  slug: 'tattslotto',
  mode: 'hot',
  basedOn: null,
  createdAt: '2026-10-18T00:00:00.000Z',
  numbers,
  powerball: null,
  system: null,
  badges: [{ id: 'hot', label: '2 hot', tone: 'hot' }],
  drawsAnalysed: 100,
  dataSource: 'thelott',
});

describe('theme store', () => {
  it('starts on the system theme and toggles to an explicit choice', () => {
    const store = createThemeStore(memoryStorage());
    expect(store.getState().mode).toBe('system');
    store.getState().toggle('dark');
    expect(store.getState().mode).toBe('light');
    store.getState().toggle('light');
    expect(store.getState().mode).toBe('dark');
  });

  it('persists the choice and restores it', async () => {
    const storage = memoryStorage();
    createThemeStore(storage).getState().setMode('light');
    const restored = createThemeStore(storage);
    await restored.persist.rehydrate();
    expect(restored.getState().mode).toBe('light');
  });

  it('ignores a corrupt stored mode', async () => {
    const storage = memoryStorage({ 'luckyape:theme': JSON.stringify({ state: { mode: 'neon' }, version: 1 }) });
    const store = createThemeStore(storage);
    await store.persist.rehydrate();
    expect(store.getState().mode).toBe('system');
  });
});

describe('ticket store', () => {
  const fixedNow = () => new Date('2026-10-18T10:00:00Z');

  it('saves newest first, stamps savedAt, and refuses duplicates', () => {
    const store = createTicketStore(memoryStorage(), fixedNow);
    expect(store.getState().save(ticket('a'))).toBe(true);
    expect(store.getState().save(ticket('b'))).toBe(true);
    expect(store.getState().save(ticket('a'))).toBe(false);
    expect(store.getState().tickets.map((t) => t.id)).toEqual(['b', 'a']);
    expect(store.getState().tickets[0].savedAt).toBe('2026-10-18T10:00:00.000Z');
  });

  it('removes and clears', () => {
    const store = createTicketStore(memoryStorage(), fixedNow);
    store.getState().save(ticket('a'));
    store.getState().save(ticket('b'));
    store.getState().remove('a');
    expect(store.getState().tickets.map((t) => t.id)).toEqual(['b']);
    store.getState().clear();
    expect(store.getState().tickets).toEqual([]);
  });

  it('keeps only the newest tickets once the cap is reached', () => {
    const store = createTicketStore(memoryStorage(), fixedNow);
    for (let i = 0; i < MAX_SAVED_TICKETS + 5; i++) store.getState().save(ticket(`t${i}`));
    const ids = store.getState().tickets.map((t) => t.id);
    expect(ids).toHaveLength(MAX_SAVED_TICKETS);
    expect(ids[0]).toBe(`t${MAX_SAVED_TICKETS + 4}`);
    expect(ids).not.toContain('t0');
  });

  it('persists across restarts', async () => {
    const storage = memoryStorage();
    createTicketStore(storage, fixedNow).getState().save(ticket('a', [7, 8, 9, 10, 11, 12]));
    const restored = createTicketStore(storage, fixedNow);
    await restored.persist.rehydrate();
    expect(restored.getState().tickets).toHaveLength(1);
    expect(restored.getState().tickets[0].numbers).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it('drops malformed stored tickets instead of crashing', async () => {
    const good = { ...ticket('ok'), savedAt: '2026-10-18T00:00:00.000Z' };
    const storage = memoryStorage({
      'luckyape:tickets': JSON.stringify({
        state: { tickets: [good, { id: 5 }, null, 'junk', { ...good, id: 'bad', numbers: ['x'] }] },
        version: 1,
      }),
    });
    const store = createTicketStore(storage, fixedNow);
    await store.persist.rehydrate();
    expect(store.getState().tickets.map((t) => t.id)).toEqual(['ok']);
  });

  it('recovers from a non-array tickets value', async () => {
    const storage = memoryStorage({ 'luckyape:tickets': JSON.stringify({ state: { tickets: 'oops' }, version: 1 }) });
    const store = createTicketStore(storage, fixedNow);
    await store.persist.rehydrate();
    expect(store.getState().tickets).toEqual([]);
  });
});
