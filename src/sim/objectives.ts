import { RACES_BY_ID } from '../data/races.ts';
import {
  MONUMENT_PRESTIGE,
  OBJECTIVE_MONUMENT_REWARD,
  OBJECTIVE_PODIUM_REWARD,
  OBJECTIVE_PODIUM_TARGET,
  OBJECTIVE_TOP_TEN_REWARD,
  OBJECTIVE_TOP_TEN_TARGET,
  OBJECTIVE_WINS_REWARD,
  OBJECTIVE_WINS_TARGET,
} from '../data/tuning.ts';
import type { Rider, WorldState } from '../data/types.ts';
import { riderRating } from './rating.ts';
import type { SeasonState } from './season.ts';

/**
 * Season objective — the sponsor's board goal (docs/cycling-sim-SEASON-FOCUS.md,
 * Part E). One deterministic goal a year (so it needs no persistence), alternating
 * between "win a Monument" and "win N races", with a modest cash reward when met.
 * Direction without complexity, sitting on top of the existing prestige/sponsor
 * loop. Pure and headless. All numbers are STARTING GUESSES (SPEC §10).
 */

export type ObjectiveKind = 'monument' | 'wins' | 'podiums' | 'top10s';

export interface SeasonObjective {
  kind: ObjectiveKind;
  text: string;
  target: number;
  reward: number;
}

export interface ObjectiveStatus {
  current: number;
  target: number;
  met: boolean;
}

/** The goal for a given season number (deterministic — alternates year to year). */
export function objectiveForSeason(seasonNumber: number): SeasonObjective {
  if (seasonNumber % 2 === 1) {
    return { kind: 'monument', text: 'Win a Monument this season', target: 1, reward: OBJECTIVE_MONUMENT_REWARD };
  }
  return { kind: 'wins', text: `Win ${OBJECTIVE_WINS_TARGET} races this season`, target: OBJECTIVE_WINS_TARGET, reward: OBJECTIVE_WINS_REWARD };
}

function teamStrength(riders: readonly Rider[], teamId: string): number {
  const ratings = riders
    .filter((rider) => rider.teamId === teamId)
    .map(riderRating)
    .sort((left, right) => right - left)
    .slice(0, 5);
  return ratings.reduce((sum, rating) => sum + rating, 0) / Math.max(1, ratings.length);
}

export function objectiveForGeneratedTeam(
  world: WorldState,
  riders: readonly Rider[],
  teamId: string,
  seasonNumber = 1,
): SeasonObjective {
  const division = world.teamSeasons[teamId].division;
  const divisionTeams = world.teams
    .filter((team) => world.teamSeasons[team.id].division === division)
    .map((team) => ({ teamId: team.id, strength: teamStrength(riders, team.id) }))
    .sort((left, right) => right.strength - left.strength);
  const strengthRank = divisionTeams.findIndex((team) => team.teamId === teamId) + 1;
  const competitive = strengthRank > 0 && strengthRank <= Math.ceil(divisionTeams.length / 2);

  if (!competitive) {
    if (seasonNumber % 2 === 0) {
      return {
        kind: 'podiums',
        text: `Earn ${OBJECTIVE_PODIUM_TARGET} race podiums`,
        target: OBJECTIVE_PODIUM_TARGET,
        reward: OBJECTIVE_PODIUM_REWARD,
      };
    }
    return {
      kind: 'top10s',
      text: `Place top 10 in ${OBJECTIVE_TOP_TEN_TARGET} races`,
      target: OBJECTIVE_TOP_TEN_TARGET,
      reward: OBJECTIVE_TOP_TEN_REWARD,
    };
  }
  if (division === 'pro') {
    if (seasonNumber % 2 === 0) {
      return { kind: 'wins', text: 'Win 2 races this season', target: 2, reward: OBJECTIVE_WINS_REWARD };
    }
    return {
      kind: 'podiums',
      text: `Earn ${OBJECTIVE_PODIUM_TARGET} race podiums`,
      target: OBJECTIVE_PODIUM_TARGET,
      reward: OBJECTIVE_PODIUM_REWARD,
    };
  }
  if (seasonNumber % 2 === 0) {
    return { kind: 'monument', text: 'Win a Monument this season', target: 1, reward: OBJECTIVE_MONUMENT_REWARD };
  }
  return { kind: 'wins', text: 'Win 2 races this season', target: 2, reward: OBJECTIVE_WINS_REWARD };
}

/**
 * How far along the objective is, from the season's banked results. `isPlayerWin`
 * decides whether a result's winner belongs to the player's team.
 */
export function objectiveStatus(objective: SeasonObjective, season: SeasonState, isPlayerRider: (riderId: string) => boolean): ObjectiveStatus {
  let current = 0;
  for (const res of season.results) {
    const bestPosition = res.classification.findIndex((row) => isPlayerRider(row.riderId)) + 1;
    if (objective.kind === 'top10s' && bestPosition > 0 && bestPosition <= 10) {
      current++;
    } else if (objective.kind === 'podiums' && bestPosition > 0 && bestPosition <= 3) {
      current++;
    } else if (objective.kind === 'wins' && res.winnerId && isPlayerRider(res.winnerId)) {
      current++;
    } else if (objective.kind === 'monument' && res.winnerId && isPlayerRider(res.winnerId) && (RACES_BY_ID.get(res.raceId)?.prestige ?? 0) >= MONUMENT_PRESTIGE) {
      current++;
    }
  }
  return { current, target: objective.target, met: current >= objective.target };
}
