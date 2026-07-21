import { RIDERS_BY_ID } from '../data/riders.ts';
import { TEAMS } from '../data/teams.ts';
import type { Stage } from '../data/types.ts';
import { baseScore } from './stageSim.ts';
import type { TeamTactics } from './tactics.ts';

/**
 * Helpers to assemble a stage's tactics. Rival AI proper is Phase 4; for now each
 * rival team simply protects whoever is best-suited to the stage and rides all-in.
 */

/** The best-suited rider (by baseScore) among a set of rider ids for a stage. */
export function bestSuitedRider(riderIds: string[], stage: Stage): string {
  return riderIds
    .map((id) => RIDERS_BY_ID.get(id)!)
    .sort((a, b) => baseScore(b, stage) - baseScore(a, stage))[0].id;
}

/** Full tactics map: the player's chosen tactics + a default for every rival team. */
export function buildTacticsMap(stage: Stage, player: TeamTactics): Map<string, TeamTactics> {
  const map = new Map<string, TeamTactics>();
  map.set(player.teamId, player);
  for (const team of TEAMS) {
    if (team.isPlayer) continue;
    map.set(team.id, {
      teamId: team.id,
      protectedRiderId: bestSuitedRider(team.riderIds, stage),
      strategy: 'ALL_IN_LEADER',
    });
  }
  return map;
}
