import { describe, expect, it } from 'vitest';

import { RIDERS } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { TEAMS } from '../data/teams.ts';
import { buildRaceStory } from './raceNarrative.ts';
import { defaultTeamTactics } from './raceSetup.ts';
import { Rng } from './rng.ts';

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
});
