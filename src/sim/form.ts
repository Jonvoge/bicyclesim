import { CONSISTENCY_FACTOR, SIGMA_MAX } from '../data/tuning.ts';
import type { Rng } from './rng.ts';

/**
 * Daily form swing (SPEC §5.3).
 *
 * A high-consistency rider has a narrow bell curve (predictable); a low-consistency
 * rider swings wildly day to day. This is what lets a favourite occasionally lose.
 */

/** Standard deviation of the form swing for a given consistency stat (1–100). */
export function sigma(consistency: number): number {
  return SIGMA_MAX * (1 - (consistency / 100) * CONSISTENCY_FACTOR);
}

/**
 * Draw the day's form swing. `sigmaMult` lets tactics widen the curve
 * (e.g. BREAKAWAY rides more aggressively → more variance, SPEC §5.5).
 */
export function drawFormSwing(rng: Rng, consistency: number, sigmaMult = 1): number {
  return rng.gaussian(0, sigma(consistency) * sigmaMult);
}
