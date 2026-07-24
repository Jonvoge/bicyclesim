import type { Rider } from '../data/types.ts';
import type { SeasonState } from '../sim/season.ts';
import type { DynastyState } from './dynasty.ts';

/**
 * localStorage persistence for the whole dynasty (Phase 5). Supersedes the
 * season-only save: the dynasty nests the season, so this one blob carries the
 * roster, budgets, contracts and season number too. SeasonState holds Maps, so
 * we (de)serialise those by hand.
 */

const KEY = 'bicyclesim.dynasty.v1';

interface SavedSeason {
  calendar: string[];
  eventIndex: number;
  fatigue: [string, number][];
  points: [string, number][];
  results: SeasonState['results'];
}

interface SavedDynasty {
  seasonNumber: number;
  roster: Rider[];
  budgets: Record<string, number>;
  season: SavedSeason;
  lastTeamRank: Record<string, number>;
  trainedThisGap: string[];
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

export function saveDynasty(dynasty: DynastyState): void {
  try {
    const saved: SavedDynasty = {
      seasonNumber: dynasty.seasonNumber,
      roster: dynasty.roster,
      budgets: dynasty.budgets,
      season: packSeason(dynasty.season),
      lastTeamRank: dynasty.lastTeamRank,
      trainedThisGap: dynasty.trainedThisGap,
    };
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // storage full / unavailable → play on unsaved rather than crash
  }
}

export function loadDynasty(): DynastyState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedDynasty;
    if (!Array.isArray(s.roster) || !s.season) return null;
    return {
      seasonNumber: s.seasonNumber ?? 1,
      roster: s.roster,
      budgets: s.budgets ?? {},
      season: unpackSeason(s.season),
      lastTeamRank: s.lastTeamRank ?? {},
      trainedThisGap: s.trainedThisGap ?? [],
    };
  } catch {
    return null;
  }
}

export function hasSavedDynasty(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function clearDynasty(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
