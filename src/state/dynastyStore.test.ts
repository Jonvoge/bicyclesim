import { beforeEach, describe, expect, it } from 'vitest';

import { createDynasty } from './dynasty.ts';
import {
  clearSlot,
  getActiveSlot,
  hasSavedDynasty,
  loadDynasty,
  loadDynastyFromSlot,
  saveDynasty,
  saveDynastyToSlot,
  setActiveSlot,
  slotInfos,
  SLOT_COUNT,
} from './dynastyStore.ts';

// In-memory localStorage for the node test environment.
function installLocalStorage(): void {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => installLocalStorage());

describe('save slots', () => {
  it('starts with every slot empty', () => {
    const infos = slotInfos();
    expect(infos.length).toBe(SLOT_COUNT);
    expect(infos.every((s) => !s.occupied)).toBe(true);
  });

  it('saves to and loads from a specific slot, with metadata', () => {
    const d = createDynasty();
    d.seasonNumber = 3;
    saveDynastyToSlot(1, d);
    const infos = slotInfos();
    expect(infos[0].occupied).toBe(false);
    expect(infos[1].occupied).toBe(true);
    expect(infos[1].seasonNumber).toBe(3);
    expect(infos[1].totalRaces).toBe(d.season.calendar.length);
    const loaded = loadDynastyFromSlot(1)!;
    expect(loaded.seasonNumber).toBe(3);
    expect(loaded.roster.length).toBe(d.roster.length);
  });

  it('round-trips Maps and development fields intact', () => {
    const d = createDynasty();
    d.season.points.set('gr-pogar', 120);
    d.season.fatigue.set('gr-pogar', 7.5);
    saveDynastyToSlot(2, d);
    const loaded = loadDynastyFromSlot(2)!;
    expect(loaded.season.points.get('gr-pogar')).toBe(120);
    expect(loaded.season.fatigue.get('gr-pogar')).toBe(7.5);
    const pogar = loaded.roster.find((r) => r.id === 'gr-pogar')!;
    expect(pogar.peakAge).toBeDefined();
    expect(pogar.ceiling).toBeDefined();
  });

  it('the active-slot helpers read/write the active slot', () => {
    setActiveSlot(2);
    expect(getActiveSlot()).toBe(2);
    const d = createDynasty();
    saveDynasty(d);
    expect(hasSavedDynasty()).toBe(true);
    expect(slotInfos()[2].occupied).toBe(true);
    expect(loadDynasty()!.roster.length).toBe(d.roster.length);
    // a different slot is unaffected
    setActiveSlot(0);
    expect(hasSavedDynasty()).toBe(false);
  });

  it('clearing a slot empties just that slot', () => {
    saveDynastyToSlot(0, createDynasty());
    saveDynastyToSlot(1, createDynasty());
    clearSlot(0);
    const infos = slotInfos();
    expect(infos[0].occupied).toBe(false);
    expect(infos[1].occupied).toBe(true);
  });

  it('migrates a legacy single-save into slot 1', () => {
    // produce a valid blob, then plant it under the old key
    saveDynastyToSlot(2, createDynasty());
    const blob = localStorage.getItem('bicyclesim.dynasty.v1.slot2')!;
    clearSlot(2);
    localStorage.setItem('bicyclesim.dynasty.v1', blob);
    const infos = slotInfos(); // triggers migration
    expect(infos[0].occupied).toBe(true);
    expect(localStorage.getItem('bicyclesim.dynasty.v1')).toBeNull();
  });
});
