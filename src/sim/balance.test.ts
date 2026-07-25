import { describe, expect, it } from 'vitest';

import { RIDERS } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { PLAYER_TEAM, TEAMS } from '../data/teams.ts';
import { BREAK_MAX_PER_TEAM } from '../data/tuning.ts';
import { buildRaceStory } from './raceNarrative.ts';
import { defaultTeamTactics } from './raceSetup.ts';
import { Rng } from './rng.ts';
import { tacticsEffect, type TacticRole, type TeamTactics } from './tactics.ts';

/**
 * Balance guards for the post-playtest race-feel pass: the mountains must actually
 * select (a pure sprinter loses *minutes* on a summit, so he can't cling to GC),
 * while a flat day stays a bunch. These lock the terrain-gap intent so a future
 * tweak to `GAP_COMPRESSION_BY_TYPE` can't silently flatten the classification.
 */

function avgGapToWinner(stageId: string, riderId: string, n = 200): number {
  const s = STAGES_BY_ID.get(stageId)!;
  const tactics = new Map(TEAMS.map((t) => [t.id, defaultTeamTactics(t, s)]));
  let sum = 0;
  let counted = 0;
  for (let i = 0; i < n; i++) {
    const story = buildRaceStory({ stage: s, riders: RIDERS, tacticsByTeam: tactics, rng: new Rng(i * 2654435761 + 7) });
    const win = story.result.order[0].timeSec;
    const e = story.result.order.find((x) => x.riderId === riderId);
    if (e && !e.dnf) {
      sum += e.timeSec - win;
      counted++;
    }
  }
  return sum / Math.max(1, counted);
}

describe('terrain selects the field (race-feel pass)', () => {
  const PURE_SPRINTER = 'gr-philq'; // sprint 95 / climbing 30

  it('a pure sprinter loses minutes on a summit finish', () => {
    expect(avgGapToWinner('st-lombardo', PURE_SPRINTER)).toBeGreaterThan(120);
  });

  it('…but rides in with the bunch on a flat day', () => {
    expect(avgGapToWinner('st-sanreno', PURE_SPRINTER)).toBeLessThan(20);
  });

  it('the summit gap dwarfs the flat gap (mountains decide GC, not the flat)', () => {
    const summit = avgGapToWinner('st-lombardo', PURE_SPRINTER);
    const flat = avgGapToWinner('st-sanreno', PURE_SPRINTER);
    expect(summit).toBeGreaterThan(flat * 8);
  });

  it('a descent finish is not a time-gaining day (the field regroups on the drop)', () => {
    // playtest note: it is very hard to gain time on a descent. A descent finish
    // should read much more like a bunch than a climb.
    const descent = avgGapToWinner('ga-6', PURE_SPRINTER); // ga-6 is the descentFinish stage
    const summit = avgGapToWinner('st-lombardo', PURE_SPRINTER);
    expect(descent).toBeLessThan(30);
    expect(summit).toBeGreaterThan(descent * 8);
  });
});

describe('attacking has a cost (no all-out-attack free lunch)', () => {
  it('over-committing riders to the attack docks every attacker', () => {
    // a focused two-rider move keeps the terrain edge; a whole-team swarm has no
    // one to set it up and marks itself — each extra attacker docks them all.
    const focused = tacticsEffect('free', { leaders: 0, domestiques: 0, frees: 2 }, 'hilly').perfMod;
    const swarm = tacticsEffect('free', { leaders: 0, domestiques: 0, frees: 5 }, 'hilly').perfMod;
    expect(swarm).toBeLessThan(focused);
  });

  it('the bunch will not tow one squad up the road (break capped per team)', () => {
    const stage = STAGES_BY_ID.get('st-strada')!;
    const allFree: TeamTactics = {
      teamId: PLAYER_TEAM.id,
      roles: Object.fromEntries(PLAYER_TEAM.riderIds.map((id) => [id, 'free' as TacticRole])),
    };
    const tactics = new Map(TEAMS.map((t) => [t.id, t.isPlayer ? allFree : defaultTeamTactics(t, stage)]));
    for (let i = 0; i < 120; i++) {
      const story = buildRaceStory({ stage, riders: RIDERS, tacticsByTeam: tactics, rng: new Rng(i * 2654435761 + 1), playerTeamId: PLAYER_TEAM.id });
      const mine = story.breakIds.filter((id) => PLAYER_TEAM.riderIds.includes(id)).length;
      expect(mine).toBeLessThanOrEqual(BREAK_MAX_PER_TEAM);
    }
  });
});
