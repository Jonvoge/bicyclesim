import { describe, expect, it } from 'vitest';

import { RIDERS } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { PLAYER_TEAM, TEAMS } from '../data/teams.ts';
import { LEGREAD_Z_FLYING, LEGREAD_Z_OFF } from '../data/tuning.ts';
import { isNotableLegRead, legReadForZ } from './legRead.ts';
import { buildRaceStory } from './raceNarrative.ts';
import { defaultTeamTactics } from './raceSetup.ts';
import { Rng } from './rng.ts';
import type { TeamTactics } from './tactics.ts';

function allDefaults(stageId: string): Map<string, TeamTactics> {
  const stage = STAGES_BY_ID.get(stageId)!;
  return new Map(TEAMS.map((t) => [t.id, defaultTeamTactics(t, stage)]));
}

describe('leg-read bucketing', () => {
  it('buckets by z-score at the thresholds', () => {
    expect(legReadForZ(LEGREAD_Z_FLYING + 0.1)).toBe('flying');
    expect(legReadForZ(1.0)).toBe('good');
    expect(legReadForZ(0)).toBe('normal');
    expect(legReadForZ(-1.0)).toBe('heavy');
    expect(legReadForZ(LEGREAD_Z_OFF - 0.1)).toBe('off');
  });

  it('only flying and off are "notable"', () => {
    expect(isNotableLegRead('flying')).toBe(true);
    expect(isNotableLegRead('off')).toBe(true);
    expect(isNotableLegRead('good')).toBe(false);
    expect(isNotableLegRead('normal')).toBe(false);
  });
});

describe('leg-reads on the race story', () => {
  it('every finisher gets a leg-read, and legs radio only ever names a flying/off rider', () => {
    const stageId = 'st-sanreno';
    const stage = STAGES_BY_ID.get(stageId)!;
    let sawFlying = false;
    let sawOff = false;
    for (let i = 0; i < 60; i++) {
      const story = buildRaceStory({
        stage,
        riders: RIDERS,
        tacticsByTeam: allDefaults(stageId),
        rng: new Rng(i * 2654435761 + 3),
        playerTeamId: PLAYER_TEAM.id,
      });
      // a read exists for every rider on the road
      for (const r of RIDERS) expect(story.legReads.has(r.id)).toBe(true);
      // legs radio lines are emitted at the gun (the reveal), not mid-race
      for (const ev of story.events.filter((e) => e.kind === 'legs')) expect(ev.t).toBeLessThan(0.1);
      for (const info of story.legReads.values()) {
        if (info.read === 'flying') sawFlying = true;
        if (info.read === 'off') sawOff = true;
      }
    }
    // across 60 seeds the extremes both show up (they're rare but real)
    expect(sawFlying).toBe(true);
    expect(sawOff).toBe(true);
  });

  it('a rival only reaches the radio on an extreme day; player notables always do', () => {
    const stageId = 'st-flandts';
    const stage = STAGES_BY_ID.get(stageId)!;
    const playerIds = new Set(PLAYER_TEAM.riderIds);
    for (let i = 0; i < 40; i++) {
      const story = buildRaceStory({
        stage,
        riders: RIDERS,
        tacticsByTeam: allDefaults(stageId),
        rng: new Rng(i * 40503 + 11),
        playerTeamId: PLAYER_TEAM.id,
      });
      const legsEvents = story.events.filter((e) => e.kind === 'legs');
      // a legs event is emitted at the gun (t small) — the reveal, not mid-race
      for (const ev of legsEvents) expect(ev.t).toBeLessThan(0.1);
    }
    expect(playerIds.size).toBeGreaterThan(0);
  });
});
