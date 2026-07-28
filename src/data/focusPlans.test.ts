import { describe, expect, it } from 'vitest';

import {
  averageCalendarCondition,
  conditionAt,
  conditionForEvent,
  defaultFocusPlanId,
  FOCUS_PLANS,
  FOCUS_PLANS_BY_ID,
  planArea,
} from './focusPlans.ts';
import { CONDITION_FLOOR, CONDITION_PERF_MAX, FOCUS_BUDGET, FOCUS_BUDGET_TOL } from './tuning.ts';
import type { Rider, StatKey } from './types.ts';

function rider(stats: Partial<Record<StatKey, number>>): Rider {
  const base: Record<StatKey, number> = {
    climbing: 50,
    flat: 50,
    sprint: 50,
    puncheur: 50,
    endurance: 50,
    stamina: 50,
    consistency: 50,
  };
  return { id: 'x', name: 'X', nationality: 'XX', age: 26, teamId: 't', stats: { ...base, ...stats }, currentFatigue: 0 };
}

describe('focus plan curves', () => {
  it('the conservation law holds — every plan spends ≈ the same form budget', () => {
    for (const plan of FOCUS_PLANS) {
      expect(Math.abs(planArea(plan) - FOCUS_BUDGET)).toBeLessThanOrEqual(FOCUS_BUDGET_TOL);
    }
  });

  it('condition stays inside [0,1] and never drops below the floor anywhere in the season', () => {
    for (const plan of FOCUS_PLANS) {
      for (let i = 0; i <= 100; i++) {
        const c = conditionAt(plan, i / 100);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
        expect(c).toBeGreaterThanOrEqual(CONDITION_FLOOR - 1e-9);
      }
    }
  });

  it('a single-peak plan peaks near its bump centre and rides near the floor far away', () => {
    const spring = FOCUS_PLANS_BY_ID.get('spring')!;
    expect(conditionAt(spring, 0.29)).toBeGreaterThan(0.9); // flying in the window
    expect(conditionAt(spring, 0.9)).toBeLessThan(CONDITION_FLOOR + 0.05); // flat by autumn
  });

  it('a sharp single peak goes higher than a double peak (the trade-off)', () => {
    const single = conditionAt(FOCUS_PLANS_BY_ID.get('spring')!, 0.29);
    const double = conditionAt(FOCUS_PLANS_BY_ID.get('twoPeaks')!, 0.29);
    expect(single).toBeGreaterThan(double);
  });

  it('steady never really peaks but never slumps', () => {
    const steady = FOCUS_PLANS_BY_ID.get('steady')!;
    for (let i = 0; i <= 100; i++) {
      const c = conditionAt(steady, i / 100);
      expect(c).toBeLessThan(0.65); // no real peak
    }
    expect(conditionAt(steady, 0.55)).toBeGreaterThan(CONDITION_FLOOR + 0.1); // a gentle year-round lift
  });

  it('conditionForEvent puts each plan ahead in its own window', () => {
    const N = 17;
    const springEarly = conditionForEvent('spring', 4, N); // t≈0.25
    const gtEarly = conditionForEvent('grandTour', 4, N);
    expect(springEarly).toBeGreaterThan(gtEarly);
    const springLate = conditionForEvent('spring', 11, N); // t≈0.69
    const gtLate = conditionForEvent('grandTour', 11, N);
    expect(gtLate).toBeGreaterThan(springLate);
  });

  it('normalizes every plan to the same discrete-calendar performance budget', () => {
    for (const calendarLength of [12, 17]) {
      const averageModifiers = FOCUS_PLANS.map(
        (plan) => (2 * averageCalendarCondition(plan.id, calendarLength) - 1) * CONDITION_PERF_MAX,
      );
      expect(Math.max(...averageModifiers) - Math.min(...averageModifiers)).toBeLessThanOrEqual(0.15);
    }
  });
});

describe('default plan assignment', () => {
  it('a climber targets the grand tours, a sprinter the spring, an all-rounder the autumn', () => {
    expect(defaultFocusPlanId(rider({ climbing: 88 }))).toBe('grandTour');
    expect(defaultFocusPlanId(rider({ sprint: 90 }))).toBe('spring');
    expect(defaultFocusPlanId(rider({ climbing: 70, sprint: 68, puncheur: 69, flat: 71 }))).toBe('autumn');
  });
});
