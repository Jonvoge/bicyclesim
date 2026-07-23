import {
  FATIGUE_BASE,
  FATIGUE_REF_KM,
  STAGE_DIFFICULTY_BY_TYPE,
  STAGE_RECOVERY_RATE,
  STAMINA_FACTOR,
} from '../data/tuning.ts';
import type { GcEntry, Race, Rider, Stage, StageResult } from '../data/types.ts';
import { effortOf, roleCounts, roleOf, tacticsEffect, type TeamTactics } from './tactics.ts';

/**
 * Stage races: GC + across-stage fatigue (SPEC §5.8). Pure and headless — no
 * Phaser. The tour holds a fatigue map and an abandon set; the global roster is
 * never mutated (each stage rides fresh rider COPIES carrying that day's fatigue),
 * so a tour is reproducible and re-runnable.
 */

export interface TourState {
  raceId: string;
  stageIds: string[];
  stageIndex: number; // the next stage to ride (== stageIds.length when done)
  fatigue: Map<string, number>; // riderId → currentFatigue going into the next stage
  abandoned: Set<string>; // DNF'd — out of the tour and out of GC
  results: StageResult[]; // completed stages, in order
}

export interface GcRow {
  riderId: string;
  totalTimeSec: number;
  gapSec: number; // behind the race leader
  stagesFinished: number;
}

/** Difficulty of a stage as a fatigue unit (type × relative length). */
export function stageDifficulty(stage: Stage): number {
  const typeW = STAGE_DIFFICULTY_BY_TYPE[stage.type] ?? 1;
  return FATIGUE_BASE * typeW * (stage.lengthKm / FATIGUE_REF_KM);
}

/** One rider's fatigue gain on a stage (SPEC §5.8), before overnight recovery. */
export function fatigueGain(rider: Rider, stage: Stage, fatigueMult: number): number {
  const staminaRelief = 1 - (rider.stats.stamina / 100) * STAMINA_FACTOR;
  return stageDifficulty(stage) * staminaRelief * fatigueMult;
}

export function createTour(race: Race): TourState {
  return {
    raceId: race.id,
    stageIds: [...race.stageIds],
    stageIndex: 0,
    fatigue: new Map(),
    abandoned: new Set(),
    results: [],
  };
}

export function isTourComplete(tour: TourState): boolean {
  return tour.stageIndex >= tour.stageIds.length;
}

/**
 * Rider copies for the upcoming stage: the still-racing field, each carrying the
 * fatigue they've accumulated. Abandoned riders are dropped from the start list.
 */
export function ridersForStage(tour: TourState, allRiders: Rider[]): Rider[] {
  return allRiders
    .filter((r) => !tour.abandoned.has(r.id))
    .map((r) => ({ ...r, currentFatigue: tour.fatigue.get(r.id) ?? 0 }));
}

/**
 * Record a finished stage: bank the result, add each rider's fatigue gain, apply
 * overnight recovery, mark abandons, and advance to the next stage. `stageRiders`
 * are the copies handed to the sim (so stamina + role are read consistently).
 */
export function recordStageResult(
  tour: TourState,
  stage: Stage,
  result: StageResult,
  tacticsByTeam: Map<string, TeamTactics>,
  stageRiders: Rider[],
): void {
  const byId = new Map(stageRiders.map((r) => [r.id, r]));
  for (const entry of result.order) {
    if (entry.dnf) {
      tour.abandoned.add(entry.riderId);
      tour.fatigue.delete(entry.riderId);
      continue;
    }
    const rider = byId.get(entry.riderId);
    if (!rider) continue;
    const tactics = rider.teamId ? tacticsByTeam.get(rider.teamId) : undefined;
    const counts = roleCounts(tactics);
    const effect = tacticsEffect(roleOf(tactics, rider.id), counts, stage.type, effortOf(tactics));
    const gained = (tour.fatigue.get(rider.id) ?? 0) + fatigueGain(rider, stage, effect.fatigueMult);
    tour.fatigue.set(rider.id, gained * STAGE_RECOVERY_RATE);
  }
  tour.results.push(result);
  tour.stageIndex += 1;
}

/**
 * General classification from the stages ridden so far: cumulative time, sorted
 * lowest-first. A rider who has abandoned, or missed any completed stage, is
 * excluded (you must finish every stage to hold a GC place).
 */
export function computeGc(tour: TourState): GcRow[] {
  const total = new Map<string, number>();
  const finished = new Map<string, number>();
  for (const result of tour.results) {
    for (const entry of result.order) {
      if (entry.dnf) continue;
      total.set(entry.riderId, (total.get(entry.riderId) ?? 0) + entry.timeSec);
      finished.set(entry.riderId, (finished.get(entry.riderId) ?? 0) + 1);
    }
  }
  const stagesDone = tour.results.length;
  const rows: GcRow[] = [];
  for (const [riderId, totalTimeSec] of total) {
    if (tour.abandoned.has(riderId)) continue;
    if ((finished.get(riderId) ?? 0) < stagesDone) continue; // missed a stage → no GC place
    rows.push({ riderId, totalTimeSec, gapSec: 0, stagesFinished: finished.get(riderId) ?? 0 });
  }
  rows.sort((a, b) => a.totalTimeSec - b.totalTimeSec);
  const leadTime = rows[0]?.totalTimeSec ?? 0;
  for (const row of rows) row.gapSec = row.totalTimeSec - leadTime;
  return rows;
}

/** GC as the plain `GcEntry[]` from the data model (SPEC §4). */
export function gcEntries(tour: TourState): GcEntry[] {
  return computeGc(tour).map((r) => ({ riderId: r.riderId, totalTimeSec: r.totalTimeSec }));
}
