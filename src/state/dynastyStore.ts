import type { Rider } from '../data/types.ts';
import type { SeasonState } from '../sim/season.ts';
import type { DynastyState } from './dynasty.ts';

/**
 * localStorage persistence for dynasties (Phase 5 + Phase 8). A dynasty nests its
 * season, so one blob carries the roster, budgets, contracts and season number.
 * SeasonState holds Maps, so we (de)serialise those by hand.
 *
 * Phase 8 adds **multiple save slots** so you can keep more than one dynasty on
 * the go. The scenes still call the slot-less `saveDynasty` / `loadDynasty`
 * helpers; those read/write the **active slot** (a persisted pointer set when a
 * game is started or continued), so the whole scene flow is untouched. The old
 * single-save key is migrated into slot 1 on first read.
 */

export const SLOT_COUNT = 3;
const slotKey = (slot: number): string => `bicyclesim.dynasty.v1.slot${slot}`;
const ACTIVE_KEY = 'bicyclesim.activeSlot';
const LEGACY_KEY = 'bicyclesim.dynasty.v1';

interface SavedSeason {
  calendar: string[];
  eventIndex: number;
  fatigue: [string, number][];
  points: [string, number][];
  results: SeasonState['results'];
}

interface SlotMeta {
  seasonNumber: number;
  racesDone: number; // events completed in the current season
  savedAt: number; // epoch ms
}

interface SavedDynasty {
  seasonNumber: number;
  roster: Rider[];
  budgets: Record<string, number>;
  season: SavedSeason;
  lastTeamRank: Record<string, number>;
  trainedThisGap: string[];
  meta?: SlotMeta;
}

export interface SlotInfo {
  slot: number;
  occupied: boolean;
  seasonNumber?: number;
  racesDone?: number;
  totalRaces?: number;
  savedAt?: number;
}

function packSeason(s: SeasonState): SavedSeason {
  return {
    calendar: s.calendar,
    eventIndex: s.eventIndex,
    fatigue: [...s.fatigue.entries()],
    points: [...s.points.entries()],
    results: s.results,
  };
}

function unpackSeason(s: SavedSeason): SeasonState {
  return {
    calendar: s.calendar,
    eventIndex: s.eventIndex,
    fatigue: new Map(s.fatigue),
    points: new Map(s.points),
    results: s.results ?? [],
  };
}

function readRaw(key: string): SavedDynasty | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedDynasty;
    if (!Array.isArray(s.roster) || !s.season) return null;
    return s;
  } catch {
    return null;
  }
}

/** One-time: move a pre-slots save into slot 1 so existing dynasties survive. */
function migrateLegacy(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === null) return;
    if (localStorage.getItem(slotKey(0)) === null) localStorage.setItem(slotKey(0), legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

// --- active slot -------------------------------------------------------------

export function getActiveSlot(): number {
  try {
    const v = Number(localStorage.getItem(ACTIVE_KEY));
    return Number.isInteger(v) && v >= 0 && v < SLOT_COUNT ? v : 0;
  } catch {
    return 0;
  }
}

export function setActiveSlot(slot: number): void {
  try {
    localStorage.setItem(ACTIVE_KEY, String(slot));
  } catch {
    // ignore
  }
}

// --- slot-addressed API ------------------------------------------------------

export function saveDynastyToSlot(slot: number, dynasty: DynastyState): void {
  try {
    const saved: SavedDynasty = {
      seasonNumber: dynasty.seasonNumber,
      roster: dynasty.roster,
      budgets: dynasty.budgets,
      season: packSeason(dynasty.season),
      lastTeamRank: dynasty.lastTeamRank,
      trainedThisGap: dynasty.trainedThisGap,
      meta: {
        seasonNumber: dynasty.seasonNumber,
        racesDone: dynasty.season.results.length,
        savedAt: Date.now(),
      },
    };
    localStorage.setItem(slotKey(slot), JSON.stringify(saved));
  } catch {
    // storage full / unavailable → play on unsaved rather than crash
  }
}

export function loadDynastyFromSlot(slot: number): DynastyState | null {
  const s = readRaw(slotKey(slot));
  if (!s) return null;
  return {
    seasonNumber: s.seasonNumber ?? 1,
    roster: s.roster,
    budgets: s.budgets ?? {},
    season: unpackSeason(s.season),
    lastTeamRank: s.lastTeamRank ?? {},
    trainedThisGap: s.trainedThisGap ?? [],
  };
}

export function clearSlot(slot: number): void {
  try {
    localStorage.removeItem(slotKey(slot));
  } catch {
    // ignore
  }
}

/** Summary of every slot for the save picker (migrates the legacy save first). */
export function slotInfos(): SlotInfo[] {
  migrateLegacy();
  const infos: SlotInfo[] = [];
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const s = readRaw(slotKey(slot));
    if (!s) {
      infos.push({ slot, occupied: false });
      continue;
    }
    infos.push({
      slot,
      occupied: true,
      seasonNumber: s.meta?.seasonNumber ?? s.seasonNumber ?? 1,
      racesDone: s.meta?.racesDone ?? s.season.results?.length ?? 0,
      totalRaces: s.season.calendar?.length ?? 0,
      savedAt: s.meta?.savedAt,
    });
  }
  return infos;
}

// --- active-slot convenience (used throughout the scene flow) ----------------

export function saveDynasty(dynasty: DynastyState): void {
  saveDynastyToSlot(getActiveSlot(), dynasty);
}

export function loadDynasty(): DynastyState | null {
  migrateLegacy();
  return loadDynastyFromSlot(getActiveSlot());
}

export function hasSavedDynasty(): boolean {
  migrateLegacy();
  return readRaw(slotKey(getActiveSlot())) !== null;
}

export function clearDynasty(): void {
  clearSlot(getActiveSlot());
}
