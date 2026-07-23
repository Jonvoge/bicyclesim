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
  // The SIGNATURE stat dominates each terrain so specialists own their day, and
  // `endurance` is a lighter shared engine (~0.2) rather than a universal ~0.3
  // tax that let the best all-rounders float to the top everywhere.
  flat: { climbing: 0.05, sprint: 0.66, puncheur: 0.11, endurance: 0.18 },
  hilly: { climbing: 0.14, sprint: 0.14, puncheur: 0.52, endurance: 0.2 },
  mountain: { climbing: 0.66, puncheur: 0.12, endurance: 0.22 },
  summitFinish: { climbing: 0.75, puncheur: 0.07, endurance: 0.18 },
  descentFinish: { climbing: 0.46, sprint: 0.12, puncheur: 0.24, endurance: 0.18 },
  cobbled: { timeTrial: 0.12, sprint: 0.22, puncheur: 0.44, endurance: 0.22 },
};
