import {
  RATING_ENDURANCE_W,
  RATING_OFFENSE_W,
  RATING_PEAK_W,
  RATING_STAMINA_W,
  SALARY_CURVE,
  SALARY_FLOOR_RATING,
  SALARY_MAX,
  SALARY_MIN,
  SIGNING_FEE_MULT,
} from '../data/tuning.ts';
import type { BaseStatKey, Rider } from '../data/types.ts';

/**
 * Rider valuation (Phase 5). A single 0–100 **overall** used to price riders on
 * the transfer market and rank the peloton. Pure and headless — no Phaser.
 *
 * The formula leans on a rider's *best* discipline (a pure sprinter is a star on
 * his day even if his climbing is poor), plus the shared engine (endurance) and
 * the stage-race resilience (stamina). Consistency/roles don't feed price. All
 * weights are STARTING GUESSES (SPEC §10).
 */

const OFFENSIVE: BaseStatKey[] = ['climbing', 'flat', 'sprint', 'puncheur', 'endurance'];

/** 0–100 overall rating for a rider. */
export function riderRating(rider: Rider): number {
  const s = rider.stats;
  const offense = OFFENSIVE.map((k) => s[k]);
  const peak = Math.max(s.climbing, s.flat, s.sprint, s.puncheur);
  const meanOffense = offense.reduce((a, b) => a + b, 0) / offense.length;
  const rating =
    RATING_PEAK_W * peak +
    RATING_OFFENSE_W * meanOffense +
    RATING_ENDURANCE_W * s.endurance +
    RATING_STAMINA_W * s.stamina;
  return Math.round(rating);
}

/** Per-season salary for a rider of this overall rating (super-linear in rating). */
export function salaryFor(rating: number): number {
  const t = Math.max(0, rating - SALARY_FLOOR_RATING) / (100 - SALARY_FLOOR_RATING);
  return Math.round(SALARY_MIN + Math.pow(t, SALARY_CURVE) * (SALARY_MAX - SALARY_MIN));
}

/** One-off signing fee to bring a free agent in (on top of their salary). */
export function signingFeeFor(rating: number): number {
  return Math.round(salaryFor(rating) * SIGNING_FEE_MULT);
}

/** Convenience: a rider's salary from their stats. */
export function riderSalary(rider: Rider): number {
  return salaryFor(riderRating(rider));
}

/**
 * A rider's archetype label from their dominant offensive stat (for the UI — so
 * you can tell a rider's *type* at a glance before signing). Close-across stats →
 * "All-rounder".
 */
export function riderType(rider: Rider): string {
  const s = rider.stats;
  const cands: [string, number][] = [
    ['Climber', s.climbing],
    ['Sprinter', s.sprint],
    ['Puncheur', s.puncheur],
    ['Rouleur', s.flat],
  ];
  cands.sort((a, b) => b[1] - a[1]);
  return cands[0][1] - cands[1][1] >= 6 ? cands[0][0] : 'All-rounder';
}

/** Short labels for the five offensive stats, in display order (for the UI). */
export const STAT_ABBREV: [BaseStatKey, string][] = [
  ['climbing', 'CLM'],
  ['flat', 'FLT'],
  ['sprint', 'SPR'],
  ['puncheur', 'PUN'],
  ['endurance', 'END'],
];

/** A compact one-line stat readout, e.g. "CLM 87  FLT 72  SPR 55  PUN 66  END 78". */
export function statLine(rider: Rider): string {
  return STAT_ABBREV.map(([k, label]) => `${label} ${rider.stats[k]}`).join('   ');
}
