import type { BaseStatKey, StageType } from './types.ts';

/**
 * Stage weightings (SPEC §5.2).
 *
 * Each stage type is a weight vector over the *base* stats; weights sum to 1.
 * `stamina` and `consistency` are modifiers (they act on fatigue and variance),
 * not base weights, so they never appear here.
 *
 * STARTING VALUES per SPEC §10 — expect to tune these once races can be watched.
 */
export const STAGE_WEIGHTS: Record<StageType, Partial<Record<BaseStatKey, number>>> = {
  flat: { climbing: 0.05, sprint: 0.55, puncheur: 0.1, endurance: 0.3 },
  hilly: { climbing: 0.15, sprint: 0.15, puncheur: 0.4, endurance: 0.3 },
  mountain: { climbing: 0.55, puncheur: 0.1, endurance: 0.35 },
  summitFinish: { climbing: 0.65, puncheur: 0.05, endurance: 0.3 },
  descentFinish: { climbing: 0.4, sprint: 0.1, puncheur: 0.25, endurance: 0.25 },
  cobbled: { timeTrial: 0.1, sprint: 0.2, puncheur: 0.35, endurance: 0.35 },
  itt: { timeTrial: 0.8, endurance: 0.2 },
  ttt: { timeTrial: 0.6, endurance: 0.4 }, // team-averaged, see SPEC §5.8 (Phase 3)
};
