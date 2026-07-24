import { FIRST_NAMES, LAST_NAMES, NATIONALITIES } from '../data/names.ts';
import {
  CEILING_HEADROOM_MAX,
  CEILING_TALENT_MAX,
  CEILING_TALENT_MIN,
  DECLINE_ABS_AGE,
  DECLINE_ACCEL,
  DECLINE_BASE,
  DEV_RATE_MAX,
  DEV_RATE_MIN,
  PEAK_AGE_MAX,
  PEAK_AGE_MEAN,
  PEAK_AGE_MIN,
  PEAK_AGE_SIGMA,
  PROSPECT_AGE_MAX,
  PROSPECT_AGE_MIN,
  PROSPECT_BASE_MAX,
  PROSPECT_BASE_MIN,
  PROSPECT_SIGNATURE_MAX,
  PROSPECT_SIGNATURE_MIN,
  RETIRE_ACCEL,
  RETIRE_AGE_MAX,
  RETIRE_AGE_MIN,
  SCOUT_CERTAIN_AGE,
  SCOUT_NOISE_MAX,
  STAT_FLOOR,
} from '../data/tuning.ts';
import type { BaseStatKey, Rider, StatKey } from '../data/types.ts';
import { Rng } from './rng.ts';

/**
 * Rider development & dynasty (SPEC §7, Phase 6). Pure and headless — no Phaser.
 *
 * Careers rise, plateau and fade on **individual** curves. Each rider carries a
 * hidden `peakAge`, per-stat `ceiling` and `developmentRate`: they grow toward the
 * ceiling until their peak, plateau through the good years, and only really
 * decline in the veteran years (an early bloomer stagnates near their ceiling, it
 * doesn't fall off a cliff). Old riders retire; young prospects enter each season
 * with **fuzzily-scouted** potential, so signing a teenager is a genuine bet.
 *
 * The seeding and ageing are deterministic (seeded per rider id / by the rollover
 * rng) so a dynasty stays reproducible.
 */

/** Stats that develop and decay with age. Consistency is a temperament, left fixed. */
export const DEV_STATS: StatKey[] = ['climbing', 'flat', 'sprint', 'puncheur', 'endurance', 'stamina'];

/** A stable per-rider RNG so seeded potential never flickers on a re-render. */
function riderRng(id: string, salt = 0): Rng {
  let h = salt >>> 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return new Rng(h || 0x1234567);
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const round1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * Give a rider hidden potential if they don't have it yet (idempotent): a peakAge,
 * a per-stat ceiling and a developmentRate, all deterministic from their id. A
 * rider already at or past their peak gets a ceiling ≈ their current stats (no
 * growth left); the young get real headroom, weighted toward the stats they're
 * already good at so specialists sharpen rather than flatten into all-rounders.
 */
export function seedDevelopment(rider: Rider): void {
  if (rider.peakAge !== undefined && rider.ceiling !== undefined && rider.developmentRate !== undefined) return;
  const rng = riderRng(rider.id, 0xd0e);
  const peakAge = clamp(Math.round(rng.gaussian(PEAK_AGE_MEAN, PEAK_AGE_SIGMA)), PEAK_AGE_MIN, PEAK_AGE_MAX);
  const talent = CEILING_TALENT_MIN + rng.next() * (CEILING_TALENT_MAX - CEILING_TALENT_MIN);
  const devRate = DEV_RATE_MIN + rng.next() * (DEV_RATE_MAX - DEV_RATE_MIN);

  // headroom remaining shrinks as a rider nears their peak (0 once at/past it)
  const youth = clamp((peakAge - rider.age) / Math.max(1, peakAge - PROSPECT_AGE_MIN), 0, 1);
  const ceiling: Partial<Record<StatKey, number>> = {};
  for (const k of DEV_STATS) {
    const cur = rider.stats[k];
    const headroom = CEILING_HEADROOM_MAX * talent * youth * (0.4 + 0.6 * (cur / 100));
    ceiling[k] = clamp(Math.round(cur + headroom), cur, 99);
  }
  rider.peakAge = peakAge;
  rider.ceiling = ceiling;
  rider.developmentRate = devRate;
}

/** Where real decline begins for this rider — the later of their peak and the veteran-years age. */
function declineStart(rider: Rider): number {
  return Math.max(rider.peakAge ?? PEAK_AGE_MEAN, DECLINE_ABS_AGE);
}

/**
 * Advance a rider one season: age up, then move each developing stat along their
 * curve — grow toward the ceiling before the peak, hold on the plateau, and shed
 * points (accelerating) once the veteran years arrive. Mutates the rider.
 */
export function ageOneSeason(rider: Rider): void {
  seedDevelopment(rider);
  rider.age += 1;
  const peak = rider.peakAge!;
  const start = declineStart(rider);
  for (const k of DEV_STATS) {
    const cur = rider.stats[k];
    const cap = rider.ceiling?.[k] ?? cur;
    if (rider.age <= peak) {
      if (cap > cur) rider.stats[k] = round1(Math.min(cap, cur + rider.developmentRate! * (cap - cur)));
    } else if (rider.age > start) {
      const yearsInto = rider.age - start; // 1 in the first declining season
      const loss = DECLINE_BASE + (yearsInto - 1) * DECLINE_ACCEL;
      rider.stats[k] = round1(Math.max(STAT_FLOOR, cur - loss));
    }
    // peak < age <= start → plateau (hold)
  }
}

/** Whether a rider retires this off-season (rises with age; certain by the max). */
export function shouldRetire(rider: Rider, rng: Rng): boolean {
  if (rider.age >= RETIRE_AGE_MAX) return true;
  if (rider.age < RETIRE_AGE_MIN) return false;
  return rng.next() < (rider.age - RETIRE_AGE_MIN) * RETIRE_ACCEL;
}

const ARCHETYPES: { sig: BaseStatKey; also?: BaseStatKey }[] = [
  { sig: 'climbing', also: 'endurance' },
  { sig: 'sprint' },
  { sig: 'puncheur', also: 'flat' },
  { sig: 'flat', also: 'endurance' },
  { sig: 'climbing', also: 'puncheur' },
];

/**
 * Generate a fresh young prospect for the free-agent pool: an archetype (a raw
 * signature stat, modest everywhere else), a plausible age, and seeded hidden
 * potential. Deterministic given the id + rng.
 */
export function generateProspect(id: string, rng: Rng): Rider {
  const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
  const nationality = rng.pick(NATIONALITIES);
  const age = PROSPECT_AGE_MIN + rng.int(PROSPECT_AGE_MAX - PROSPECT_AGE_MIN + 1);
  const arch = rng.pick(ARCHETYPES);

  const base = (): number => Math.round(PROSPECT_BASE_MIN + rng.next() * (PROSPECT_BASE_MAX - PROSPECT_BASE_MIN));
  const sig = (): number => Math.round(PROSPECT_SIGNATURE_MIN + rng.next() * (PROSPECT_SIGNATURE_MAX - PROSPECT_SIGNATURE_MIN));
  const stats: Record<StatKey, number> = {
    climbing: base(),
    flat: base(),
    sprint: base(),
    puncheur: base(),
    endurance: base(),
    stamina: base(),
    consistency: Math.round(55 + rng.next() * 25),
  };
  stats[arch.sig] = sig();
  if (arch.also) stats[arch.also] = Math.max(stats[arch.also], base() + 8);

  const rider: Rider = { id, name, nationality, age, teamId: null, stats, currentFatigue: 0 };
  seedDevelopment(rider);
  return rider;
}

/**
 * Generate a squad domestique to pad a team to its target depth (Phase 8-era
 * pick-5). A journeyman: an archetype at modest, workmanlike numbers (below the
 * authored stars), a settled age, seeded so a new game is reproducible.
 */
export function generateDomestique(id: string, teamId: string, rng: Rng): Rider {
  const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
  const nationality = rng.pick(NATIONALITIES);
  const age = 24 + rng.int(8); // 24–31
  const arch = rng.pick(ARCHETYPES);
  const base = (): number => Math.round(46 + rng.next() * 18); // 46–64
  const stats: Record<StatKey, number> = {
    climbing: base(),
    flat: base(),
    sprint: base(),
    puncheur: base(),
    endurance: base(),
    stamina: base(),
    consistency: Math.round(60 + rng.next() * 22),
  };
  stats[arch.sig] = Math.round(60 + rng.next() * 12); // 60–72 signature
  if (arch.also) stats[arch.also] = Math.max(stats[arch.also], base() + 6);

  const rider: Rider = { id, name, nationality, age, teamId, stats, currentFatigue: 0 };
  seedDevelopment(rider);
  return rider;
}

export interface ScoutReport {
  stars: number; // 1–5, the shown potential (fuzzy for the young)
  ceiling: number; // scouted peak overall (true ceiling ± a shrinking error)
  certain: boolean; // has the fuzz collapsed (an established rider)?
  label: string; // 'raw' / 'developing' / 'known'
}

/**
 * Scout a rider's potential — deliberately **uncertain** for the young (SPEC §7).
 * The scouted ceiling is the true best-overall-at-ceiling plus a seeded error that
 * shrinks to nothing by `SCOUT_CERTAIN_AGE`, so two identical-looking teenagers can
 * turn out very differently. Deterministic per rider (stable across re-renders).
 */
export function scoutReport(rider: Rider): ScoutReport {
  seedDevelopment(rider);
  const c = rider.ceiling ?? {};
  // best-case overall: the rider's stats topped up to their ceilings
  const peakStats = { ...rider.stats } as Record<StatKey, number>;
  for (const k of DEV_STATS) peakStats[k] = Math.max(peakStats[k], c[k] ?? peakStats[k]);
  const trueCeiling = Math.max(peakStats.climbing, peakStats.flat, peakStats.sprint, peakStats.puncheur);

  const uncertainty = clamp((SCOUT_CERTAIN_AGE - rider.age) / (SCOUT_CERTAIN_AGE - PROSPECT_AGE_MIN), 0, 1);
  const noise = riderRng(rider.id, 0x5c07).gaussian(0, SCOUT_NOISE_MAX * uncertainty);
  const scouted = clamp(Math.round(trueCeiling + noise), 40, 99);

  // 1–5 stars off the scouted ceiling (≈66 → 2★, ≈80 → 3★, ≈95+ → 5★)
  const stars = clamp(Math.round((scouted - 59) / 7), 1, 5);
  const certain = uncertainty <= 0.01;
  const label = certain ? 'known' : uncertainty > 0.6 ? 'raw' : 'developing';
  return { stars, ceiling: scouted, certain, label };
}
