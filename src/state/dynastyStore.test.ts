import { beforeEach, describe, expect, it } from 'vitest';

import { acceptSquadProposal, generateWorldDraft } from '../sim/worldGeneration.ts';
import { createDynasty, createGeneratedDynasty } from './dynasty.ts';
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

  it('round-trips a generated world without regenerating it', () => {
    const draft = generateWorldDraft({ seed: 310519 });
    const dynasty = createGeneratedDynasty(acceptSquadProposal(draft, draft.proposals[2].id));
    dynasty.world!.teamSeasons[dynasty.playerTeamId].budget += 77;
    saveDynastyToSlot(1, dynasty);

    const loaded = loadDynastyFromSlot(1)!;
    expect(loaded.world).toEqual(dynasty.world);
    expect(loaded.roster).toEqual(dynasty.roster);
    expect(loaded.world?.seed).toBe(310519);
    expect(loaded.world?.teamSeasons[loaded.playerTeamId].budget).toBe(dynasty.world!.teamSeasons[dynasty.playerTeamId].budget);
    expect(slotInfos()[1].teamName).toBe(dynasty.world!.teams.find((team) => team.isPlayer)!.name);
  });

  it('migrates generated worlds created before competition fields', () => {
    const draft = generateWorldDraft({ seed: 310520 });
    const dynasty = createGeneratedDynasty(acceptSquadProposal(draft, draft.proposals[0].id));
    saveDynastyToSlot(0, dynasty);
    const key = 'bicyclesim.dynasty.v1.slot0';
    const oldSave = JSON.parse(localStorage.getItem(key)!);
    delete oldSave.world.eventFields;
    for (const state of Object.values(oldSave.world.teamSeasons) as Record<string, unknown>[]) {
      delete state.wins;
      delete state.bestPrestigeResult;
    }
    localStorage.setItem(key, JSON.stringify(oldSave));

    const loaded = loadDynastyFromSlot(0)!;
    expect(loaded.world?.eventFields).toEqual([]);
    expect(Object.values(loaded.world!.teamSeasons).every((state) => state.wins === 0 && state.bestPrestigeResult === 0)).toBe(true);
  });

  it('round-trips the latest structured event settlement', () => {
    const d = createDynasty();
    d.lastSettlement = {
      result: { raceId: 'r-test', classification: [], winnerId: '' },
      notablePlayerResults: [],
      riderPointsGained: [],
      teamPointsGained: 0,
      prizeMoney: 25,
      budgetBalance: 100,
      objective: { text: 'Test', before: 0, current: 0, target: 1, completed: false },
      fatigue: [],
      training: null,
      milestones: [],
    };
    saveDynastyToSlot(0, d);
    expect(loadDynastyFromSlot(0)!.lastSettlement).toEqual(d.lastSettlement);
  });

  it('uplifts prospects from older saves once', () => {
    const d = createDynasty();
    d.roster.push({
      id: 'fa-gen-old-0',
      name: 'Old Prospect',
      nationality: 'Italy',
      age: 21,
      teamId: null,
      stats: { climbing: 60, flat: 50, sprint: 50, puncheur: 50, endurance: 50, stamina: 50, consistency: 70 },
      currentFatigue: 0,
      peakAge: 27,
      ceiling: { climbing: 70, flat: 60, sprint: 60, puncheur: 60, endurance: 60, stamina: 60 },
      developmentRate: 0.3,
    });
    saveDynastyToSlot(0, d);
    const key = 'bicyclesim.dynasty.v1.slot0';
    const oldSave = JSON.parse(localStorage.getItem(key)!);
    delete oldSave.balanceVersion;
    localStorage.setItem(key, JSON.stringify(oldSave));

    const migrated = loadDynastyFromSlot(0)!.roster.find((r) => r.id === 'fa-gen-old-0')!;
    expect(migrated.stats.climbing).toBe(64);
    expect(migrated.stats.flat).toBe(52);
    expect(migrated.ceiling!.climbing).toBe(74);
    expect(migrated.ceiling!.flat).toBe(62);

    const loadedAgain = loadDynastyFromSlot(0)!.roster.find((r) => r.id === 'fa-gen-old-0')!;
    expect(loadedAgain.stats.climbing).toBe(64);
    expect(loadedAgain.stats.flat).toBe(52);
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
