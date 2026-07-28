import { STAGE_WEIGHTS } from '../data/stageWeights.ts';
import {
  CONDITION_NEUTRAL,
  CONDITION_PERF_MAX,
  FATIGUE_REF_KM,
  FATIGUE_WEIGHT,
  GAP_COMPRESSION_BY_TYPE,
  GAP_SPREAD,
  LENGTH_ENDURANCE_RANGE_KM,
  LENGTH_ENDURANCE_WEIGHT_SHIFT,
  REFERENCE_SPEED_KMH,
} from '../data/tuning.ts';
import type { BaseStatKey, Rider, Stage, StageResult, StageResultEntry } from '../data/types.ts';
import { sigma } from './form.ts';
import type { Rng } from './rng.ts';
import { effortOf, roleOf, tacticsEffect, type RoleCounts, type TeamTactics } from './tactics.ts';

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
  const weights = stageWeightsForLength(stage);
  let score = 0;
  for (const key of Object.keys(weights) as BaseStatKey[]) {
    score += rider.stats[key] * (weights[key] ?? 0);
  }
  return score;
}

/** Reallocate a bounded share of terrain weight to endurance as stages lengthen. */
export function stageWeightsForLength(stage: Stage): Partial<Record<BaseStatKey, number>> {
  const base = STAGE_WEIGHTS[stage.type];
  const baseEndurance = base.endurance ?? 0;
  const normalizedLength = Math.max(-1, Math.min(1, (stage.lengthKm - FATIGUE_REF_KM) / LENGTH_ENDURANCE_RANGE_KM));
  const endurance = Math.max(0.01, Math.min(0.99, baseEndurance + normalizedLength * LENGTH_ENDURANCE_WEIGHT_SHIFT));
  const otherScale = (1 - endurance) / Math.max(0.01, 1 - baseEndurance);
  const adjusted: Partial<Record<BaseStatKey, number>> = {};
  for (const key of Object.keys(base) as BaseStatKey[]) {
    adjusted[key] = key === 'endurance' ? endurance : (base[key] ?? 0) * otherScale;
  }
  return adjusted;
}

/** Stable pre-race standing used for contextual favourite classification. */
export function preRaceReputation(rider: Rider, stage: Stage): number {
  const fatiguePen = rider.currentFatigue * FATIGUE_WEIGHT;
  const conditionMod = (2 * (rider.condition ?? CONDITION_NEUTRAL) - 1) * CONDITION_PERF_MAX;
  return baseScore(rider, stage) - fatiguePen + conditionMod;
}

export interface ScoredRider {
  riderId: string;
  perfScore: number;
  formSwing: number; // the day's form draw (SPEC §5.3) — surfaced for the leg-read reveal
  sigmaUsed: number; // the σ that swing was drawn from, so z = formSwing / sigmaUsed
}

export interface StageSimInput {
  stage: Stage;
  riders: Rider[];
  /** Tactics per team id. Teams without an entry ride neutrally. */
  tacticsByTeam: Map<string, TeamTactics>;
  rng: Rng;
  /** Which team is the player's (whose role sheet the narrative strictly respects). */
  playerTeamId?: string;
}

/** Per-rider performance for the day (before any narrative events). */
export function scoreRiders(input: StageSimInput): ScoredRider[] {
  const { stage, riders, tacticsByTeam, rng } = input;
  // Count roles from the riders actually on the road (not the full sheet): a
  // default/unlisted rider rides FREE, and only starters count toward the
  // attack-crowd penalty and the domestique support that a leader really has.
  const countsByTeam = new Map<string, RoleCounts>();
  for (const rider of riders) {
    if (!rider.teamId) continue;
    const role = roleOf(tacticsByTeam.get(rider.teamId), rider.id);
    const c = countsByTeam.get(rider.teamId) ?? { leaders: 0, domestiques: 0, frees: 0 };
    if (role === 'leader') c.leaders++;
    else if (role === 'domestique') c.domestiques++;
    else if (role === 'free') c.frees++;
    countsByTeam.set(rider.teamId, c);
  }
  const noRoles: RoleCounts = { leaders: 0, domestiques: 0, frees: 0 };

  return riders.map((rider) => {
    const tactics = rider.teamId ? tacticsByTeam.get(rider.teamId) : undefined;
    const effect = tacticsEffect(roleOf(tactics, rider.id), countsByTeam.get(rider.teamId ?? '') ?? noRoles, stage.type, effortOf(tactics));

    const base = preRaceReputation(rider, stage);
    const sigmaUsed = sigma(rider.stats.consistency) * effect.sigmaMult;
    const formSwing = rng.gaussian(0, sigmaUsed);
    const perfScore = base + formSwing + effect.perfMod;
    return { riderId: rider.id, perfScore, formSwing, sigmaUsed };
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
  // terrain decides how far the field spreads: flat → bunch, summit → shattered
  const compression = GAP_COMPRESSION_BY_TYPE[stage.type] ?? 1;

  const entries: StageResultEntry[] = scored.map((s) => {
    const gap = Math.max(0, (topPerf - s.perfScore) * GAP_SPREAD * compression);
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
