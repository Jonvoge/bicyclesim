import { RACES_BY_ID } from '../data/races.ts';
import { RECOVERY_RATE, SEASON_EVENT_POINTS } from '../data/tuning.ts';
import type { Race, Rider } from '../data/types.ts';
import { computeGc, createTour, type GcRow, type TourState } from './standings.ts';

/**
 * Season layer (SPEC §6, Phase 4). A season is an ordered calendar of race events
 * (one-days + tours). Two things persist across events that a single race can't
 * see: a **season points** tally (who's having the best year) and **fatigue that
 * carries between races** with recovery on the gaps — so a team can't ride every
 * rider flat-out all year. Pure and headless — no Phaser. Reuses the Phase 3
 * `TourState` machinery: an event's tour is seeded from each rider's carried
 * season fatigue, and its end-of-event fatigue (recovered) carries to the next.
 */

export interface SeasonState {
  calendar: string[]; // race ids, in calendar order
  eventIndex: number; // next event to contest (== calendar.length when the season is over)
  fatigue: Map<string, number>; // riderId → season fatigue carried into the next event
  points: Map<string, number>; // riderId → season points so far
  results: SeasonResult[]; // archive, one per contested event
}

export interface SeasonResult {
  raceId: string;
  classification: GcRow[]; // final order (one-day finish / tour GC)
  winnerId: string;
}

export interface StandingRow {
  id: string; // rider id or team id
  points: number;
}

export function createSeason(calendar: string[]): SeasonState {
  return { calendar: [...calendar], eventIndex: 0, fatigue: new Map(), points: new Map(), results: [] };
}

export function isSeasonComplete(season: SeasonState): boolean {
  return season.eventIndex >= season.calendar.length;
}

export function currentRace(season: SeasonState): Race | null {
  if (isSeasonComplete(season)) return null;
  return RACES_BY_ID.get(season.calendar[season.eventIndex]) ?? null;
}

/**
 * Open the next event as a tour, seeded with each rider's carried season fatigue,
 * so a tired rider starts the race tired. Drive it with the Phase 3 flow
 * (`ridersForStage` → sim → `recordStageResult`), then call `finishEvent`.
 * `startList` lets the player rest riders (omit them); omitted riders simply don't
 * start and recover on the sidelines (see `finishEvent`).
 */
export function startEvent(season: SeasonState, startList: Rider[]): TourState {
  const race = currentRace(season)!;
  const tour = createTour(race);
  tour.starters = new Set(startList.map((r) => r.id));
  for (const rider of startList) tour.fatigue.set(rider.id, season.fatigue.get(rider.id) ?? 0);
  return tour;
}

/**
 * Bank a finished event: award season points from its final classification
 * (scaled by race prestige), carry each rider's fatigue back to the season with
 * between-race recovery (riders who didn't start still recover), archive it, and
 * advance the calendar.
 */
export function finishEvent(season: SeasonState, tour: TourState, allRiders: Rider[]): SeasonResult {
  const race = RACES_BY_ID.get(tour.raceId)!;
  const classification = computeGc(tour);

  // points: position × prestige
  for (let i = 0; i < classification.length; i++) {
    const base = SEASON_EVENT_POINTS[i];
    if (base === undefined) break;
    const pts = Math.round((base * race.prestige) / 100);
    const id = classification[i].riderId;
    season.points.set(id, (season.points.get(id) ?? 0) + pts);
  }

  // fatigue: those who raced carry their end-of-event fatigue; everyone recovers
  // toward fresh between races (a rested rider decays fastest — they gained none)
  for (const rider of allRiders) {
    const raced = tour.fatigue.has(rider.id) || tour.abandoned.has(rider.id);
    const end = raced ? tour.fatigue.get(rider.id) ?? 0 : season.fatigue.get(rider.id) ?? 0;
    season.fatigue.set(rider.id, end * RECOVERY_RATE);
  }

  const result: SeasonResult = {
    raceId: race.id,
    classification,
    winnerId: classification[0]?.riderId ?? '',
  };
  season.results.push(result);
  season.eventIndex += 1;
  return result;
}

/** Individual season ranking: riders by total points, highest first. */
export function riderStandings(season: SeasonState): StandingRow[] {
  return [...season.points.entries()]
    .map(([id, points]) => ({ id, points }))
    .sort((a, b) => b.points - a.points);
}

/** Team season ranking: sum of each team's riders' points, highest first. */
export function teamStandings(season: SeasonState, teamOf: (riderId: string) => string | null): StandingRow[] {
  const byTeam = new Map<string, number>();
  for (const [riderId, pts] of season.points) {
    const teamId = teamOf(riderId);
    if (!teamId) continue;
    byTeam.set(teamId, (byTeam.get(teamId) ?? 0) + pts);
  }
  return [...byTeam.entries()].map(([id, points]) => ({ id, points })).sort((a, b) => b.points - a.points);
}
