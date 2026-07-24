import { RIDERS_BY_ID } from '../data/riders.ts';
import { TEAMS } from '../data/teams.ts';
import type { Rider, Stage, Team } from '../data/types.ts';
import { baseScore } from './stageSim.ts';
import { BUNCH_FINISH, type TacticRole, type TeamTactics } from './tactics.ts';

/**
 * Helpers to assemble a stage's role sheets. Rival AI proper is Phase 4; for now
 * every team gets a sensible default: best-suited rider leads, a genuine fast
 * finisher gets the SPRINTER role on bunch-finish terrain, everyone else works.
 * This is also the player's pre-filled sheet in the PreRace screen.
 *
 * The `*For` variants take the actual rider objects, so from Phase 5 they can be
 * driven by the mutable **dynasty** roster (signed free agents, trained stats)
 * rather than the static team lists — the `Team`-based wrappers keep the old
 * static callers (Quick Race, tests) working.
 */

const AI_SPRINTER_MIN_STAT = 85; // only a real sprinter gets the sprinter role

/** The best-suited rider (by baseScore) among a set of rider objects for a stage. */
export function bestSuitedAmong(riders: Rider[], stage: Stage): Rider {
  return [...riders].sort((a, b) => baseScore(b, stage) - baseScore(a, stage))[0];
}

/** The best-suited rider id among a set of rider ids (static lookup). */
export function bestSuitedRider(riderIds: string[], stage: Stage): string {
  return bestSuitedAmong(
    riderIds.map((id) => RIDERS_BY_ID.get(id)!),
    stage,
  ).id;
}

/** Default role sheet for a set of team riders on a stage (deterministic). */
export function defaultTeamTacticsFor(teamId: string, riders: Rider[], stage: Stage): TeamTactics {
  const roles: Record<string, TacticRole> = {};
  const leaderId = bestSuitedAmong(riders, stage).id;
  roles[leaderId] = 'leader';

  if (BUNCH_FINISH.includes(stage.type)) {
    const sprinter = riders
      .filter((r) => r.id !== leaderId && r.stats.sprint >= AI_SPRINTER_MIN_STAT)
      .sort((a, b) => b.stats.sprint - a.stats.sprint)[0];
    if (sprinter) roles[sprinter.id] = 'sprinter';
  }

  for (const r of riders) if (!roles[r.id]) roles[r.id] = 'domestique';
  return { teamId, roles };
}

/** Default role sheet for a team on a stage (static team list). */
export function defaultTeamTactics(team: Team, stage: Stage): TeamTactics {
  return defaultTeamTacticsFor(
    team.id,
    team.riderIds.map((id) => RIDERS_BY_ID.get(id)!),
    stage,
  );
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
