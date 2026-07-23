import type { SeasonState } from '../sim/season.ts';

/**
 * localStorage persistence for the season (SPEC §2 — saves live in localStorage
 * for now). A season is ~14 events, so it must survive a refresh / the app being
 * closed on a phone. SeasonState carries Maps, so we (de)serialise them by hand.
 */

const KEY = 'bicyclesim.season.v1';

interface SavedSeason {
  calendar: string[];
  eventIndex: number;
  fatigue: [string, number][];
  points: [string, number][];
  results: SeasonState['results'];
}

export function saveSeason(season: SeasonState): void {
  try {
    const saved: SavedSeason = {
      calendar: season.calendar,
      eventIndex: season.eventIndex,
      fatigue: [...season.fatigue.entries()],
      points: [...season.points.entries()],
      results: season.results,
    };
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // storage full / unavailable → play on unsaved rather than crash
  }
}

export function loadSeason(): SeasonState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedSeason;
    if (!Array.isArray(s.calendar)) return null;
    return {
      calendar: s.calendar,
      eventIndex: s.eventIndex,
      fatigue: new Map(s.fatigue),
      points: new Map(s.points),
      results: s.results ?? [],
    };
  } catch {
    return null;
  }
}

export function hasSavedSeason(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSeason(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
