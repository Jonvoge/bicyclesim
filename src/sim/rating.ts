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
