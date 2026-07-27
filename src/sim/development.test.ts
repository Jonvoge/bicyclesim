import { describe, expect, it } from 'vitest';

import { RIDERS_BY_ID } from '../data/riders.ts';
import { PROSPECT_AGE_MAX, PROSPECT_AGE_MIN, RETIRE_AGE_MAX, RETIRE_AGE_MIN } from '../data/tuning.ts';
import type { Rider, StatKey } from '../data/types.ts';
import { riderRating } from './rating.ts';
import {
  ageOneSeason,
  DEV_STATS,
  generateProspect,
  scoutReport,
  seedDevelopment,
  shouldRetire,
  trainingTick,
} from './development.ts';
import { Rng } from './rng.ts';

/** A synthetic rider with explicit stats for precise curve tests. */
function make(age: number, over: Partial<Rider> = {}): Rider {
  const stats: Record<StatKey, number> = {
    climbing: 70,
    flat: 60,
    sprint: 55,
    puncheur: 60,
    endurance: 70,
    stamina: 70,
    consistency: 75,
  };
  return { id: 'test-r', name: 'Test Rider', nationality: 'Italy', age, teamId: 't-x', stats, currentFatigue: 0, ...over };
}

describe('seedDevelopment', () => {
  it('gives the young headroom and the old almost none, and is idempotent', () => {
    const young = RIDERS_BY_ID.get('gr-vance')!; // age 21
    const vet = RIDERS_BY_ID.get('so-rogla')!; // age 34
    const y = { ...young, stats: { ...young.stats } };
    const v = { ...vet, stats: { ...vet.stats } };
    seedDevelopment(y);
    seedDevelopment(v);
    const yHead = DEV_STATS.reduce((s, k) => s + (y.ceiling![k]! - y.stats[k]), 0);
    const vHead = DEV_STATS.reduce((s, k) => s + (v.ceiling![k]! - v.stats[k]), 0);
    expect(yHead).toBeGreaterThan(vHead);
    expect(vHead).toBeLessThanOrEqual(2); // a 34yo has essentially no growth left
    // idempotent: a second call doesn't move the ceiling
    const before = JSON.stringify(y.ceiling);
    seedDevelopment(y);
    expect(JSON.stringify(y.ceiling)).toBe(before);
  });
});

describe('ageOneSeason — the individual curve', () => {
  it('grows a pre-peak rider toward the ceiling', () => {
    const r = make(21, { peakAge: 27, developmentRate: 0.35, ceiling: { climbing: 90 } });
    ageOneSeason(r);
    expect(r.age).toBe(22);
    expect(r.stats.climbing).toBeGreaterThan(70);
    expect(r.stats.climbing).toBeLessThanOrEqual(90);
  });

  it('holds a rider on the plateau (past peak, before the veteran years)', () => {
    const r = make(29, { peakAge: 26, developmentRate: 0.35, ceiling: { climbing: 90 } });
    const before = r.stats.climbing;
    ageOneSeason(r); // age 30, still ≤ decline age
    expect(r.stats.climbing).toBe(before);
  });

  it('declines a veteran, accelerating with age', () => {
    const r = make(33, { peakAge: 27, developmentRate: 0.35, ceiling: { climbing: 90 } });
    const s0 = r.stats.climbing;
    ageOneSeason(r); // 34
    const drop1 = s0 - r.stats.climbing;
    const s1 = r.stats.climbing;
    ageOneSeason(r); // 35
    const drop2 = s1 - r.stats.climbing;
    expect(drop1).toBeGreaterThan(0);
    expect(drop2).toBeGreaterThan(drop1); // fade accelerates
  });
});

describe('trainingTick — automatic development', () => {
  it('develops a young rider toward the ceiling, hardest on their type, never past it', () => {
    const r = make(21, {
      peakAge: 28,
      developmentRate: 0.35,
      // type = the top two stats (climbing, flat); endurance is off-type; sprint is capped
      stats: { climbing: 80, flat: 72, sprint: 55, puncheur: 50, endurance: 60, stamina: 52, consistency: 75 },
      ceiling: { climbing: 92, flat: 84, sprint: 55, puncheur: 58, endurance: 70, stamina: 62 },
    });
    const gain = trainingTick(r);
    expect(gain.total).toBeGreaterThan(0);
    expect(Object.keys(gain.byStat)).toHaveLength(5); // every stat with headroom moves, not just the focus pair
    expect(gain.byStat.climbing).toBeGreaterThan(0); // the signature stat is named as having moved
    expect(r.stats.climbing).toBeGreaterThan(80); // their signature grows
    expect(r.stats.climbing).toBeLessThanOrEqual(92); // but never past the ceiling
    expect(r.stats.sprint).toBe(55); // no headroom → no change
    // the type stat (climbing) closes more of its gap than an off-type stat (endurance)
    const climbClosed = (r.stats.climbing - 80) / (92 - 80);
    const endClosed = (r.stats.endurance - 60) / (70 - 60);
    expect(climbClosed).toBeGreaterThan(endClosed);
  });

  it('gives a past-peak veteran nothing (you cannot train up age)', () => {
    const r = make(33, { peakAge: 27, developmentRate: 0.35, ceiling: { climbing: 99, sprint: 99 } });
    const before = { ...r.stats };
    expect(trainingTick(r).total).toBe(0);
    expect(r.stats).toEqual(before);
  });
});

describe('shouldRetire', () => {
  it('never before the min, always by the max', () => {
    const rng = new Rng(1);
    expect(shouldRetire(make(RETIRE_AGE_MIN - 1), rng)).toBe(false);
    expect(shouldRetire(make(RETIRE_AGE_MAX), rng)).toBe(true);
  });

  it('retires more often the older the rider (over many draws)', () => {
    const count = (age: number) => {
      let n = 0;
      for (let i = 0; i < 400; i++) if (shouldRetire(make(age), new Rng(i * 7 + 1))) n++;
      return n;
    };
    expect(count(37)).toBeGreaterThan(count(34));
  });
});

describe('generateProspect', () => {
  it('makes a valid young free agent with hidden potential', () => {
    const r = generateProspect('fa-gen-2-0', new Rng(99));
    expect(r.teamId).toBeNull();
    expect(r.age).toBeGreaterThanOrEqual(PROSPECT_AGE_MIN);
    expect(r.age).toBeLessThanOrEqual(PROSPECT_AGE_MAX);
    expect(r.peakAge).toBeDefined();
    expect(r.ceiling).toBeDefined();
    expect(r.name.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('produces a generation capable of replacing the authored peloton', () => {
    const prospects = Array.from({ length: 200 }, (_, i) => generateProspect(`cohort-${i}`, new Rng(i * 7919 + 17)));
    const peakRatings = prospects
      .map((r) => riderRating({
        ...r,
        stats: { ...r.stats, ...Object.fromEntries(DEV_STATS.map((k) => [k, r.ceiling?.[k] ?? r.stats[k]])) },
      }))
      .sort((a, b) => a - b);

    expect(peakRatings[Math.floor(peakRatings.length / 2)]).toBeGreaterThanOrEqual(77);
    expect(peakRatings.filter((rating) => rating >= 85).length).toBeGreaterThanOrEqual(15);
  });
});

describe('scoutReport', () => {
  it('is fuzzy for the young and certain for the established', () => {
    const teen = generateProspect('fa-gen-1-0', new Rng(3));
    teen.age = 19;
    const vet = { ...RIDERS_BY_ID.get('so-rogla')!, stats: { ...RIDERS_BY_ID.get('so-rogla')!.stats } };
    const ry = scoutReport(teen);
    const rv = scoutReport(vet);
    expect(ry.certain).toBe(false);
    expect(rv.certain).toBe(true);
    expect(ry.stars).toBeGreaterThanOrEqual(1);
    expect(ry.stars).toBeLessThanOrEqual(5);
  });

  it('is stable across calls (no flicker)', () => {
    const p = generateProspect('fa-gen-1-1', new Rng(5));
    expect(scoutReport(p)).toEqual(scoutReport(p));
  });
});
