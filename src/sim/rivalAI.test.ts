import { describe, expect, it } from 'vitest';

import { RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { PLAYER_TEAM, TEAMS } from '../data/teams.ts';
import { RIVAL_MIN_STARTERS } from '../data/tuning.ts';
import { rivalRestSet } from './rivalAI.ts';

const summit = STAGES_BY_ID.get('st-lombardo')!; // climbers' day — sprinters can't contest

describe('rival AI: season-aware resting', () => {
  it('rests nobody when the field is fresh', () => {
    expect(rivalRestSet(new Map(), summit).size).toBe(0);
  });

  it('benches a tired, ill-suited rival (a fatigued sprinter on a summit finish)', () => {
    const sprinter = 'bo-ackermann'; // Bora sprinter, hopeless on a summit
    const rest = rivalRestSet(new Map([[sprinter, 12]]), summit);
    expect(rest.has(sprinter)).toBe(true);
  });

  it('never rests the player team, and never a well-suited leader', () => {
    // everyone carrying heavy fatigue
    const fatigue = new Map([...RIDERS_BY_ID.keys()].map((id) => [id, 15]));
    const rest = rivalRestSet(fatigue, summit);
    for (const id of rest) expect(RIDERS_BY_ID.get(id)!.teamId).not.toBe(PLAYER_TEAM.id);
    // the best climber in the field (a leader on a summit) is not benched
    const bestClimber = [...RIDERS_BY_ID.values()].filter((r) => r.teamId !== PLAYER_TEAM.id).sort((a, b) => b.stats.climbing - a.stats.climbing)[0];
    expect(rest.has(bestClimber.id)).toBe(false);
  });

  it('keeps at least the minimum number of starters per rival team', () => {
    const fatigue = new Map([...RIDERS_BY_ID.keys()].map((id) => [id, 20]));
    const rest = rivalRestSet(fatigue, summit);
    for (const team of TEAMS) {
      if (team.isPlayer) continue;
      const started = team.riderIds.filter((id) => !rest.has(id)).length;
      expect(started).toBeGreaterThanOrEqual(RIVAL_MIN_STARTERS);
    }
  });
});
