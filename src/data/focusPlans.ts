import { CONDITION_FLOOR } from './tuning.ts';
import type { Rider } from './types.ts';

/**
 * Season Focus plans (docs/cycling-sim-SEASON-FOCUS.md, Part A). A data-driven
 * registry — like the role registry (SPEC §5.5) — describing the season-long
 * **Condition** curve a rider rides: *where* in the calendar they peak. Pure data +
 * curve maths; no Phaser, no sim imports (the sim/state layers read from here).
 *
 * The strategy is a conservation law: every plan spends a fixed budget of hump
 * "area", so a sharp single peak goes higher than a double, and Steady never peaks
 * but never slumps. You choose *where* to spend a fixed form budget, not whether to
 * have more of it. Every rider is auto-assigned a sensible default by archetype
 * (minimal friction); the player can override. ALL numbers here are STARTING
 * GUESSES (SPEC §10).
 */

export interface FocusBump {
  center: number; // peak position as a fraction of the season, t ∈ [0,1]
  width: number; // σ of the hump in season-fraction (how long the form lasts)
  height: number; // peak lift above CONDITION_FLOOR
}

export interface FocusPlan {
  id: string;
  label: string; // player-facing
  blurb: string; // one line for the palette
  color: number; // chip / calendar-band colour
  bumps: FocusBump[];
}

// Windows for the season calendar: Spring (t≈0.29), Summer/grand tours (t≈0.68),
// Autumn (t≈0.91). Areas are hand-balanced to ≈ FOCUS_BUDGET (a harness/test check
// asserts it), so no plan sneaks in free form.
export const FOCUS_PLANS: FocusPlan[] = [
  {
    id: 'spring',
    label: 'Spring Classics',
    blurb: 'Flying for the cobbles & Ardennes',
    color: 0x4fb0c6,
    bumps: [{ center: 0.29, width: 0.1, height: 0.62 }],
  },
  {
    id: 'grandTour',
    label: 'Grand Tour',
    blurb: 'Slow build, peak for the summer tours',
    color: 0xe0a23b,
    bumps: [{ center: 0.68, width: 0.1, height: 0.62 }],
  },
  {
    id: 'autumn',
    label: 'Autumn',
    blurb: 'Saves it for the late Monuments',
    color: 0xc4623a,
    bumps: [{ center: 0.91, width: 0.1, height: 0.62 }],
  },
  {
    id: 'twoPeaks',
    label: 'Two Peaks',
    blurb: 'A spring and a fall peak — each lower',
    color: 0x8a7fc0,
    bumps: [
      { center: 0.29, width: 0.09, height: 0.34 },
      { center: 0.91, width: 0.09, height: 0.34 },
    ],
  },
  {
    id: 'steady',
    label: 'Steady',
    blurb: 'Never great, never bad — all year',
    color: 0x8a9bb0,
    bumps: [{ center: 0.55, width: 0.4, height: 0.22 }],
  },
];

export const FOCUS_PLANS_BY_ID: Map<string, FocusPlan> = new Map(FOCUS_PLANS.map((p) => [p.id, p]));
export const DEFAULT_FOCUS_PLAN_ID = 'steady';

/** Condition (0..1) a plan yields at season position `t` ∈ [0,1] (Gaussian humps over a floor). */
export function conditionAt(plan: FocusPlan, t: number): number {
  let lift = 0;
  for (const b of plan.bumps) {
    const z = (t - b.center) / b.width;
    lift += b.height * Math.exp(-0.5 * z * z);
  }
  const c = CONDITION_FLOOR + lift;
  return c < 0 ? 0 : c > 1 ? 1 : c;
}

/**
 * Condition for a rider's plan at a given event (0-based) in an N-event season.
 * Deterministic — no RNG — so the player can plan around it. An unknown/undefined
 * plan id falls back to the neutral default plan.
 */
export function conditionForEvent(planId: string | undefined, eventIndex: number, calendarLength: number): number {
  const plan = FOCUS_PLANS_BY_ID.get(planId ?? '') ?? FOCUS_PLANS_BY_ID.get(DEFAULT_FOCUS_PLAN_ID)!;
  const rawCondition = rawConditionForEvent(plan, eventIndex, calendarLength);
  const planLift = averageRawLift(plan, calendarLength);
  const targetLift = FOCUS_PLANS.reduce((sum, candidate) => sum + averageRawLift(candidate, calendarLength), 0) / FOCUS_PLANS.length;
  const normalized = CONDITION_FLOOR + (rawCondition - CONDITION_FLOOR) * (targetLift / Math.max(Number.EPSILON, planLift));
  return Math.max(0, Math.min(1, normalized));
}

function rawConditionForEvent(plan: FocusPlan, eventIndex: number, calendarLength: number): number {
  const t = calendarLength <= 1 ? 0.5 : eventIndex / (calendarLength - 1);
  return conditionAt(plan, t);
}

function averageRawLift(plan: FocusPlan, calendarLength: number): number {
  const count = Math.max(1, calendarLength);
  let total = 0;
  for (let eventIndex = 0; eventIndex < count; eventIndex++) {
    total += rawConditionForEvent(plan, eventIndex, count) - CONDITION_FLOOR;
  }
  return total / count;
}

export function averageCalendarCondition(planId: string, calendarLength: number): number {
  const count = Math.max(1, calendarLength);
  let total = 0;
  for (let eventIndex = 0; eventIndex < count; eventIndex++) {
    total += conditionForEvent(planId, eventIndex, count);
  }
  return total / count;
}

/** Total hump-area of a plan — the conserved "form budget" (Part A.3). */
export function planArea(plan: FocusPlan): number {
  return plan.bumps.reduce((s, b) => s + b.height * b.width, 0);
}

/**
 * The default plan for a rider, by archetype (minimal friction — a hands-off player
 * still gets sensible peaks). Climbers target the summer grand tours, all-rounders
 * the late Monuments, everyone else the spring classics. Mirrors the archetype
 * split of `riderType` (rating.ts) but stays here so this module has no sim import.
 */
export function defaultFocusPlanId(rider: Rider): string {
  const s = rider.stats;
  const cands: [string, number][] = [
    ['climbing', s.climbing],
    ['sprint', s.sprint],
    ['puncheur', s.puncheur],
    ['flat', s.flat],
  ];
  cands.sort((a, b) => b[1] - a[1]);
  const [topKey, topVal] = cands[0];
  if (topVal - cands[1][1] < 6) return 'autumn'; // all-rounder → late-season Monuments
  if (topKey === 'climbing') return 'grandTour';
  return 'spring';
}
