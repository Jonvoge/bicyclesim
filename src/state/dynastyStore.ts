import { PLAYER_TEAM, TEAMS_BY_ID } from '../data/teams.ts';
import { DYNASTY_SAVE_SCHEMA_VERSION } from '../data/tuning.ts';
import type { Rider, StatKey, WorldState } from '../data/types.ts';
import { DEV_STATS } from '../sim/development.ts';
import type { SeasonState } from '../sim/season.ts';
import { objectiveForGeneratedTeam, objectiveForSeason, type SeasonObjective } from '../sim/objectives.ts';
import type { DynastyState, EventSettlementSummary } from './dynasty.ts';

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
const PROSPECT_BALANCE_VERSION = 2;
const LEGACY_PROSPECT_BASE_UPLIFT = 2;
const LEGACY_PROSPECT_SIGNATURE_UPLIFT = 2;

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
  teamName?: string;
}

interface SavedDynasty {
  schemaVersion?: number;
  balanceVersion?: number;
  seasonNumber: number;
  playerTeamId?: string; // optional for pre-team-select saves (default below)
  roster: Rider[];
  budgets: Record<string, number>;
  season: SavedSeason;
  lastTeamRank: Record<string, number>;
  lastSettlement?: EventSettlementSummary | null;
  seasonDev?: Record<string, Partial<Record<StatKey, number>>>; // season-to-date development (optional for pre-ext saves)
  objective?: SeasonObjective;
  world?: WorldState;
  meta?: SlotMeta;
}

export interface SlotInfo {
  slot: number;
  occupied: boolean;
  seasonNumber?: number;
  racesDone?: number;
  totalRaces?: number;
  savedAt?: number;
  teamName?: string;
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

function migrateWorld(world: WorldState | undefined): boolean {
  if (!world) return false;
  let changed = false;
  if (!Array.isArray(world.eventFields)) {
    world.eventFields = [];
    changed = true;
  }
  if (!Array.isArray(world.directorPlans)) {
    world.directorPlans = [];
    changed = true;
  }
  if (!Array.isArray(world.history.stageWinners)) {
    world.history.stageWinners = [];
    changed = true;
  }
  for (const state of Object.values(world.teamSeasons)) {
    if (state.wins === undefined) {
      state.wins = 0;
      changed = true;
    }
    if (state.bestPrestigeResult === undefined) {
      state.bestPrestigeResult = 0;
      changed = true;
    }
  }
  return changed;
}

/** Bring prospects generated before the Phase 8 playtest rebalance onto the new ranges. */
function migrateProspectBalance(saved: SavedDynasty): boolean {
  if ((saved.balanceVersion ?? 1) >= PROSPECT_BALANCE_VERSION) return false;
  const offensive: StatKey[] = ['climbing', 'flat', 'sprint', 'puncheur'];
  for (const rider of saved.roster) {
    if (!rider.id.startsWith('fa-gen-')) continue;
    const signature = offensive.sort((a, b) => rider.stats[b] - rider.stats[a])[0];
    for (const stat of DEV_STATS) {
      const uplift = LEGACY_PROSPECT_BASE_UPLIFT + (stat === signature ? LEGACY_PROSPECT_SIGNATURE_UPLIFT : 0);
      rider.stats[stat] = Math.min(99, rider.stats[stat] + uplift);
      if (rider.ceiling?.[stat] !== undefined) {
        rider.ceiling[stat] = Math.min(99, Math.max(rider.stats[stat], rider.ceiling[stat]! + uplift));
      }
    }
  }
  saved.balanceVersion = PROSPECT_BALANCE_VERSION;
  return true;
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
      schemaVersion: DYNASTY_SAVE_SCHEMA_VERSION,
      balanceVersion: PROSPECT_BALANCE_VERSION,
      seasonNumber: dynasty.seasonNumber,
      playerTeamId: dynasty.playerTeamId,
      roster: dynasty.roster,
      budgets: dynasty.budgets,
      season: packSeason(dynasty.season),
      lastTeamRank: dynasty.lastTeamRank,
      lastSettlement: dynasty.lastSettlement,
      seasonDev: dynasty.seasonDev,
      objective: dynasty.objective,
      world: dynasty.world,
      meta: {
        seasonNumber: dynasty.seasonNumber,
        racesDone: dynasty.season.results.length,
        savedAt: Date.now(),
        teamName: dynasty.world?.teams.find((team) => team.id === dynasty.playerTeamId)?.name
          ?? TEAMS_BY_ID.get(dynasty.playerTeamId)?.name,
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
  const migrated = migrateProspectBalance(s);
  const worldMigrated = migrateWorld(s.world);
  if (migrated || worldMigrated) {
    try {
      localStorage.setItem(slotKey(slot), JSON.stringify(s));
    } catch {
      // play with the migrated in-memory save if storage is unavailable
    }
  }
  const playerTeamId = s.playerTeamId ?? PLAYER_TEAM.id;
  return {
    seasonNumber: s.seasonNumber ?? 1,
    playerTeamId,
    roster: s.roster,
    budgets: s.budgets ?? {},
    season: unpackSeason(s.season),
    lastTeamRank: s.lastTeamRank ?? {},
    lastTraining: null, // recomputed each event; camps are not persisted
    lastSettlement: s.lastSettlement ?? null,
    seasonDev: s.seasonDev ?? {},
    objective: s.objective ?? (s.world
      ? objectiveForGeneratedTeam(s.world, s.roster, playerTeamId)
      : objectiveForSeason(s.seasonNumber ?? 1)),
    world: s.world,
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
      teamName: s.meta?.teamName
        ?? s.world?.teams.find((team) => team.id === s.playerTeamId)?.name
        ?? TEAMS_BY_ID.get(s.playerTeamId ?? PLAYER_TEAM.id)?.name,
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
