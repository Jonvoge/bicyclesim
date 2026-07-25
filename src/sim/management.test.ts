import { describe, expect, it } from 'vitest';

import { RIDERS_BY_ID } from '../data/riders.ts';
import { MAX_SQUAD_SIZE, MIN_SQUAD_SIZE } from '../data/tuning.ts';
import type { Rider } from '../data/types.ts';
import {
  canRelease,
  canSign,
  eventPrizeByTeam,
  salaryOf,
  sponsorIncome,
  wageBill,
} from './management.ts';
import { riderRating, salaryFor, signingFeeFor } from './rating.ts';

describe('rider rating & valuation', () => {
  it('rates a star above a journeyman', () => {
    const star = RIDERS_BY_ID.get('gr-pogar')!; // elite GC rider
    const domestique = RIDERS_BY_ID.get('mv-romo')!; // climbing domestique
    expect(riderRating(star)).toBeGreaterThan(riderRating(domestique));
  });

  it('salary rises with rating and the signing fee is a premium on it', () => {
    expect(salaryFor(90)).toBeGreaterThan(salaryFor(65));
    expect(signingFeeFor(80)).toBeGreaterThan(salaryFor(80));
  });
});

describe('wage bill', () => {
  it('sums the salaries of a team’s riders', () => {
    const roster: Rider[] = [
      { ...RIDERS_BY_ID.get('gr-pogar')!, salary: 500 },
      { ...RIDERS_BY_ID.get('gr-gann')!, salary: 300 },
      { ...RIDERS_BY_ID.get('vm-vinge')!, salary: 999 }, // different team, ignored
    ];
    expect(wageBill(roster, 't-grenoble')).toBe(800);
  });

  it('falls back to a derived salary when none is stored', () => {
    const r = RIDERS_BY_ID.get('gr-pogar')!;
    expect(salaryOf({ ...r, salary: undefined })).toBe(salaryFor(riderRating(r)));
  });
});

describe('sponsor income', () => {
  it('pays a better-ranked team more', () => {
    expect(sponsorIncome(1, 8)).toBeGreaterThan(sponsorIncome(8, 8));
  });

  it('treats a first season (no rank) as mid-table', () => {
    const first = sponsorIncome(undefined, 8);
    expect(first).toBeGreaterThan(sponsorIncome(8, 8));
    expect(first).toBeLessThan(sponsorIncome(1, 8));
  });
});

describe('event prize money', () => {
  const teamOf = (id: string) => RIDERS_BY_ID.get(id)?.teamId ?? null;

  it('pays the winning team the most and scales with prestige', () => {
    const classification = [{ riderId: 'gr-pogar' }, { riderId: 'vm-vinge' }, { riderId: 'ua-remco' }];
    const low = eventPrizeByTeam(classification, 60, teamOf);
    const high = eventPrizeByTeam(classification, 100, teamOf);
    expect(high.get('t-grenoble')!).toBeGreaterThan(high.get('t-vesma')!);
    expect(high.get('t-grenoble')!).toBeGreaterThan(low.get('t-grenoble')!);
  });
});

describe('squad rules', () => {
  it('blocks signing when the squad is full or the budget is short', () => {
    expect(canSign(1000, MAX_SQUAD_SIZE, 200).ok).toBe(false); // full
    expect(canSign(100, 6, 200).ok).toBe(false); // too dear
    expect(canSign(1000, 6, 200).ok).toBe(true);
  });

  it('blocks releasing below the squad minimum', () => {
    expect(canRelease(MIN_SQUAD_SIZE).ok).toBe(false);
    expect(canRelease(MIN_SQUAD_SIZE + 1).ok).toBe(true);
  });
});
