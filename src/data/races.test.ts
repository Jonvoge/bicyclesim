import { describe, expect, it } from 'vitest';
import { PRO_CALENDAR, RACES_BY_ID, WORLD_CALENDAR, calendarForDivision } from './races.ts';
import { STAGES_BY_ID } from './stages.ts';
import type { DivisionId, StageType } from './types.ts';

const ALL_TERRAINS: StageType[] = ['flat', 'hilly', 'mountain', 'summitFinish', 'descentFinish', 'cobbled'];

describe('division calendars', () => {
  it('contains distinct complete calendars in the configured range', () => {
    expect(WORLD_CALENDAR).toHaveLength(17);
    expect(PRO_CALENDAR.length).toBeGreaterThanOrEqual(12);
    expect(PRO_CALENDAR.length).toBeLessThanOrEqual(15);
    expect(PRO_CALENDAR.filter((raceId) => WORLD_CALENDAR.includes(raceId))).toEqual([]);
    expect(calendarForDivision('world')).toBe(WORLD_CALENDAR);
    expect(calendarForDivision('pro')).toBe(PRO_CALENDAR);
  });

  it.each<[DivisionId, readonly string[]]>([
    ['world', WORLD_CALENDAR],
    ['pro', PRO_CALENDAR],
  ])('%s events have valid routes, eligibility, and broad terrain coverage', (division, calendar) => {
    const terrain = new Set<StageType>();
    for (const raceId of calendar) {
      const race = RACES_BY_ID.get(raceId);
      expect(race, raceId).toBeDefined();
      expect(race!.eligibility.division).toBe(division);
      expect(race!.eligibility.fieldSize).toBeGreaterThan(0);
      expect(race!.eligibility.divisionPointsScale).toBe(1);
      for (const stageId of race!.stageIds) {
        const stage = STAGES_BY_ID.get(stageId);
        expect(stage, `${raceId}: ${stageId}`).toBeDefined();
        if (division === 'world') {
          expect(stage!.elevationProfile?.length, `${stageId} authored profile`).toBeGreaterThanOrEqual(12);
          expect(stage!.elevationProfile!.every((sample) => sample >= 0 && sample <= 1), `${stageId} normalized profile`).toBe(true);
        }
        terrain.add(stage!.type);
      }
    }
    expect([...terrain].sort()).toEqual([...ALL_TERRAINS].sort());
  });

  it('limits wildcard slots to World Tour races and keeps them inside field size', () => {
    for (const race of RACES_BY_ID.values()) {
      const wildcardSlots = race.eligibility.wildcardSlots ?? 0;
      if (wildcardSlots > 0) expect(race.eligibility.division).toBe('world');
      expect(wildcardSlots).toBeLessThan(race.eligibility.fieldSize);
    }
  });

  it('gives every World Tour stage a distinct authored profile', () => {
    const stages = WORLD_CALENDAR.flatMap((raceId) => RACES_BY_ID.get(raceId)!.stageIds)
      .map((stageId) => STAGES_BY_ID.get(stageId)!);
    expect(new Set(stages.map((stage) => JSON.stringify(stage.elevationProfile))).size).toBe(stages.length);
  });
});