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
  //
  // `flat` = flat-road power / engine. It matters most on the flatter terrain
  // (the run-in, the pavé, the break), so it's a real secondary factor on
  // flat/cobbled/descent days — but `sprint` still decides a bunch kick, so the
  // fast men keep winning the sprints. It's absent uphill (mountain/summit).
  // (Inner keys are stats; the `flat:` line is the flat STAGE weighting its stats.)
  flat: { climbing: 0.04, flat: 0.14, sprint: 0.58, puncheur: 0.09, endurance: 0.15 },
  hilly: { climbing: 0.14, flat: 0.06, sprint: 0.12, puncheur: 0.5, endurance: 0.18 },
  mountain: { climbing: 0.66, puncheur: 0.12, endurance: 0.22 },
  summitFinish: { climbing: 0.75, puncheur: 0.07, endurance: 0.18 },
  descentFinish: { climbing: 0.42, flat: 0.14, sprint: 0.1, puncheur: 0.2, endurance: 0.14 },
  cobbled: { flat: 0.26, sprint: 0.16, puncheur: 0.4, endurance: 0.18 },
};
