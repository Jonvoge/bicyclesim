import { STAGE_WEIGHTS } from '../data/stageWeights.ts';
import { FATIGUE_WEIGHT, GAP_SPREAD, REFERENCE_SPEED_KMH } from '../data/tuning.ts';
import type { BaseStatKey, Rider, Stage, StageResult, StageResultEntry } from '../data/types.ts';
import { drawFormSwing } from './form.ts';
import type { Rng } from './rng.ts';
import { tacticsEffect, type TeamTactics } from './tactics.ts';

/**
 * Single-stage algorithm (SPEC §5.1).
 *
 * For each rider:
 *   baseScore  = Σ stat[k] * stageWeight[type][k]     // weighted suitability, ~1–100
 *   formSwing  = gaussian(0, sigma(consistency))       // daily form (SPEC §5.3)
 *   fatiguePen = currentFatigue * FATIGUE_WEIGHT        // 0 in a one-day race
 *   tacticsMod = tacticsEffect(...)                     // SPEC §5.5
 *   perfScore  = baseScore + formSwing - fatiguePen + tacticsMod
 *
 * Then sort by perfScore descending → finishing order, and convert to times (§5.7).
 *
 * NOTE: crashes/illness (SPEC §5.6) are intentionally NOT here yet — they land in
 * Phase 3. `dnf` is always false for now.
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

export interface StageSimInput {
  stage: Stage;
  riders: Rider[];
  /** Tactics per team id. Teams without an entry ride neutrally. */
  tacticsByTeam: Map<string, TeamTactics>;
  rng: Rng;
}

export function simulateStage(input: StageSimInput): StageResult {
  const { stage, riders, tacticsByTeam, rng } = input;

  const scored: StageResultEntry[] = riders.map((rider) => {
    const tactics = rider.teamId ? tacticsByTeam.get(rider.teamId) : undefined;
    const isProtected = tactics?.protectedRiderId === rider.id;
    const effect = tacticsEffect(tactics, isProtected);

    const base = baseScore(rider, stage);
    const formSwing = drawFormSwing(rng, rider.stats.consistency, effect.sigmaMult);
    const fatiguePen = rider.currentFatigue * FATIGUE_WEIGHT;
    const perfScore = base + formSwing - fatiguePen + effect.perfMod;

    return { riderId: rider.id, perfScore, timeSec: 0, dnf: false };
  });

  // Sort best-first.
  scored.sort((a, b) => b.perfScore - a.perfScore);

  // Convert perfScore differences into times (SPEC §5.7).
  const winnerTimeSec = (stage.lengthKm / REFERENCE_SPEED_KMH) * 3600;
  const winnerPerf = scored.length > 0 ? scored[0].perfScore : 0;
  for (const entry of scored) {
    const gap = Math.max(0, (winnerPerf - entry.perfScore) * GAP_SPREAD);
    entry.timeSec = winnerTimeSec + gap;
  }

  return { stageId: stage.id, order: scored };
}
