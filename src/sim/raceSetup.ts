import { RIDERS_BY_ID } from '../data/riders.ts';
import { TEAMS } from '../data/teams.ts';
import type { Stage, Team } from '../data/types.ts';
import { baseScore } from './stageSim.ts';
import { BUNCH_FINISH, type TacticRole, type TeamTactics } from './tactics.ts';

/**
 * Helpers to assemble a stage's role sheets. Rival AI proper is Phase 4; for now
 * every team gets a sensible default: best-suited rider leads, a genuine fast
 * finisher gets the SPRINTER role on bunch-finish terrain, everyone else works.
 * This is also the player's pre-filled sheet in the PreRace screen.
 */

const AI_SPRINTER_MIN_STAT = 85; // only a real sprinter gets the sprinter role

/** The best-suited rider (by baseScore) among a set of rider ids for a stage. */
export function bestSuitedRider(riderIds: string[], stage: Stage): string {
  return riderIds
    .map((id) => RIDERS_BY_ID.get(id)!)
    .sort((a, b) => baseScore(b, stage) - baseScore(a, stage))[0].id;
}

/** Default role sheet for a team on a stage (deterministic). */
export function defaultTeamTactics(team: Team, stage: Stage): TeamTactics {
  const roles: Record<string, TacticRole> = {};
  const riders = team.riderIds.map((id) => RIDERS_BY_ID.get(id)!);
  const leaderId = bestSuitedRider(team.riderIds, stage);
  roles[leaderId] = 'leader';

  if (BUNCH_FINISH.includes(stage.type)) {
    const sprinter = riders
      .filter((r) => r.id !== leaderId && r.stats.sprint >= AI_SPRINTER_MIN_STAT)
      .sort((a, b) => b.stats.sprint - a.stats.sprint)[0];
    if (sprinter) roles[sprinter.id] = 'sprinter';
  }

  for (const r of riders) if (!roles[r.id]) roles[r.id] = 'domestique';
  return { teamId: team.id, roles };
}

/** Full tactics map: the player's role sheet + a default for every rival team. */
export function buildTacticsMap(stage: Stage, player: TeamTactics): Map<string, TeamTactics> {
  const map = new Map<string, TeamTactics>();
  map.set(player.teamId, player);
  for (const team of TEAMS) {
    if (team.isPlayer) continue;
    map.set(team.id, defaultTeamTactics(team, stage));
  }
  return map;
}
