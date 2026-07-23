import { STAGE_WEIGHTS } from '../data/stageWeights.ts';
import { FATIGUE_WEIGHT, GAP_SPREAD, REFERENCE_SPEED_KMH } from '../data/tuning.ts';
import type { BaseStatKey, Rider, Stage, StageResult, StageResultEntry } from '../data/types.ts';
import { drawFormSwing } from './form.ts';
import type { Rng } from './rng.ts';
import { roleCounts, roleOf, tacticsEffect, type RoleCounts, type TeamTactics } from './tactics.ts';

/**
 * Single-stage algorithm (SPEC §5.1). Split into two steps so the race-narrative
 * layer (§5.9) can insert events between scoring and the final result:
 *   scoreRiders  → per-rider perfScore (base suitability + form − fatigue + tactics)
 *   perfToResult → sort + convert to times (§5.7)
 * simulateStage runs both, unchanged for callers that just want a result.
 *
 * Crashes/illness (§5.6) live in the narrative layer, not here.
 */

/** Weighted suitability of a rider for a stage type (~1–100). */
export function baseScore(rider: Rider, stage: Stage): number {
  const weights = STAGE_WEIGHTS[stage.type];
  let score = 0;
  for (const key of Object.keys(weights) as BaseStatKey[]) {
    score += rider.stats[key] * (weights[key] ?? 0);
  }
  return score;
}

export interface ScoredRider {
  riderId: string;
  perfScore: number;
}

export interface StageSimInput {
  stage: Stage;
  riders: Rider[];
  /** Tactics per team id. Teams without an entry ride neutrally. */
  tacticsByTeam: Map<string, TeamTactics>;
  rng: Rng;
}

/** Per-rider performance for the day (before any narrative events). */
export function scoreRiders(input: StageSimInput): ScoredRider[] {
  const { stage, riders, tacticsByTeam, rng } = input;
  const countsByTeam = new Map<string, RoleCounts>();
  for (const [teamId, tactics] of tacticsByTeam) countsByTeam.set(teamId, roleCounts(tactics));
  const noRoles: RoleCounts = { leaders: 0, domestiques: 0 };

  return riders.map((rider) => {
    const tactics = rider.teamId ? tacticsByTeam.get(rider.teamId) : undefined;
    const effect = tacticsEffect(roleOf(tactics, rider.id), countsByTeam.get(rider.teamId ?? '') ?? noRoles, stage.type);

    const base = baseScore(rider, stage);
    const formSwing = drawFormSwing(rng, rider.stats.consistency, effect.sigmaMult);
    const fatiguePen = rider.currentFatigue * FATIGUE_WEIGHT;
    const perfScore = base + formSwing - fatiguePen + effect.perfMod;
    return { riderId: rider.id, perfScore };
  });
}

/**
 * Convert scores to a finishing order + times (SPEC §5.7). Optional
 * `timePenalties` (seconds, e.g. from crashes) and `dnfIds` come from the
 * narrative layer. Riders sort by finishing time; DNFs are placed last.
 */
export function perfToResult(
  stage: Stage,
  scored: ScoredRider[],
  timePenalties: Map<string, number> = new Map(),
  dnfIds: Set<string> = new Set(),
): StageResult {
  const winnerTimeSec = (stage.lengthKm / REFERENCE_SPEED_KMH) * 3600;
  const topPerf = scored.reduce((m, s) => Math.max(m, s.perfScore), -Infinity);

  const entries: StageResultEntry[] = scored.map((s) => {
    const gap = Math.max(0, (topPerf - s.perfScore) * GAP_SPREAD);
    const penalty = timePenalties.get(s.riderId) ?? 0;
    return {
      riderId: s.riderId,
      perfScore: s.perfScore,
      timeSec: winnerTimeSec + gap + penalty,
      dnf: dnfIds.has(s.riderId),
    };
  });

  entries.sort((a, b) => {
    if (a.dnf !== b.dnf) return a.dnf ? 1 : -1; // DNFs last
    return a.timeSec - b.timeSec;
  });

  return { stageId: stage.id, order: entries };
}

/** Full single-stage result with no narrative events (used by tests/harness). */
export function simulateStage(input: StageSimInput): StageResult {
  return perfToResult(input.stage, scoreRiders(input));
}
