import { RACES_BY_ID } from '../data/races.ts';
import {
  MONUMENT_PRESTIGE,
  OBJECTIVE_MONUMENT_REWARD,
  OBJECTIVE_WINS_REWARD,
  OBJECTIVE_WINS_TARGET,
} from '../data/tuning.ts';
import type { SeasonState } from './season.ts';

/**
 * Season objective — the sponsor's board goal (docs/cycling-sim-SEASON-FOCUS.md,
 * Part E). One deterministic goal a year (so it needs no persistence), alternating
 * between "win a Monument" and "win N races", with a modest cash reward when met.
 * Direction without complexity, sitting on top of the existing prestige/sponsor
 * loop. Pure and headless. All numbers are STARTING GUESSES (SPEC §10).
 */

export type ObjectiveKind = 'monument' | 'wins';

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

/**
 * How far along the objective is, from the season's banked results. `isPlayerWin`
 * decides whether a result's winner belongs to the player's team.
 */
export function objectiveStatus(objective: SeasonObjective, season: SeasonState, isPlayerWin: (winnerId: string) => boolean): ObjectiveStatus {
  let current = 0;
  for (const res of season.results) {
    if (!res.winnerId || !isPlayerWin(res.winnerId)) continue;
    if (objective.kind === 'wins') {
      current++;
    } else if ((RACES_BY_ID.get(res.raceId)?.prestige ?? 0) >= MONUMENT_PRESTIGE) {
      current++;
    }
  }
  return { current, target: objective.target, met: current >= objective.target };
}
