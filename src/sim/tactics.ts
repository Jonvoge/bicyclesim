import {
  ALL_IN_HELPER_PENALTY,
  BREAK_PERF_BONUS,
  BREAK_SIGMA_MULT,
  BREAK_TERRAIN_PENALTY,
  CONSERVE_PENALTY,
  LEADER_BONUS,
  ROLE_MULTIPLIER_ALL_IN,
  ROLE_MULTIPLIER_CONSERVE,
  ROLE_MULTIPLIER_DEFAULT,
  ROLE_MULTIPLIER_SPRINT,
  SPRINT_FINISH_BONUS,
  SPRINT_FINISH_CLIMB_PENALTY,
} from '../data/tuning.ts';
import type { RaceType, StageType } from '../data/types.ts';

/**
 * Tactics (SPEC §5.5) — a race-type-aware, data-driven strategy registry so the
 * palette widens without touching logic. The player picks a protected rider (also
 * the rider "sent up the road" for a breakaway) + a strategy valid for the race.
 */

export type Strategy = 'PROTECT_LEADER' | 'BREAKAWAY' | 'SPRINT_FINISH' | 'CONSERVE';

export interface StrategyDef {
  id: Strategy;
  label: string; // player-facing
  blurb: string;
  raceTypes: RaceType[]; // where this strategy is offered
}

export const STRATEGIES: StrategyDef[] = [
  {
    id: 'PROTECT_LEADER',
    label: 'Protect Leader',
    blurb: 'Ride the whole team for your leader.',
    raceTypes: ['oneDay', 'shortTour', 'grandTour'],
  },
  {
    id: 'BREAKAWAY',
    label: 'Attack',
    blurb: 'Back your rider to go clear — a domestique in the morning break, or a leader attacking late.',
    raceTypes: ['oneDay', 'shortTour', 'grandTour'],
  },
  {
    id: 'SPRINT_FINISH',
    label: 'Sit in for the Sprint',
    blurb: 'Save it and back your fast finisher in a bunch kick.',
    raceTypes: ['oneDay'],
  },
  {
    id: 'CONSERVE',
    label: 'Conserve for GC',
    blurb: 'Give up today to save legs for the overall.',
    raceTypes: ['shortTour', 'grandTour'],
  },
];

export const STRATEGIES_BY_ID: Map<Strategy, StrategyDef> = new Map(STRATEGIES.map((s) => [s.id, s]));

export function strategiesForRaceType(type: RaceType): StrategyDef[] {
  return STRATEGIES.filter((s) => s.raceTypes.includes(type));
}

export interface TeamTactics {
  teamId: string;
  protectedRiderId: string;
  strategy: Strategy;
}

/** How a strategy modifies one rider's stage performance. */
export interface TacticsEffect {
  perfMod: number; // added to perfScore
  sigmaMult: number; // multiplies the form-swing sigma
  roleMultiplier: number; // fatigue multiplier — consumed in Phase 3, exposed now
}

const NEUTRAL: TacticsEffect = { perfMod: 0, sigmaMult: 1, roleMultiplier: ROLE_MULTIPLIER_DEFAULT };

const BREAK_FRIENDLY: StageType[] = ['hilly', 'mountain', 'cobbled', 'descentFinish'];
const SPRINT_UNFRIENDLY_FOR_BREAK: StageType[] = ['flat'];
const BUNCH_FINISH: StageType[] = ['flat', 'hilly', 'cobbled'];
const CLIMB_FINISH: StageType[] = ['mountain', 'summitFinish'];

/**
 * Resolve the effect for a single rider given their team's tactics and the terrain.
 * `isProtected` = this rider is the one the team rides for (or sends up the road).
 */
export function tacticsEffect(
  tactics: TeamTactics | undefined,
  isProtected: boolean,
  stageType: StageType,
): TacticsEffect {
  if (!tactics) return NEUTRAL;

  switch (tactics.strategy) {
    case 'PROTECT_LEADER':
      return isProtected
        ? { perfMod: LEADER_BONUS, sigmaMult: 1, roleMultiplier: ROLE_MULTIPLIER_DEFAULT }
        : { perfMod: -ALL_IN_HELPER_PENALTY, sigmaMult: 1, roleMultiplier: ROLE_MULTIPLIER_ALL_IN };

    case 'BREAKAWAY': {
      if (!isProtected) return NEUTRAL;
      const perfMod = BREAK_FRIENDLY.includes(stageType)
        ? BREAK_PERF_BONUS
        : SPRINT_UNFRIENDLY_FOR_BREAK.includes(stageType)
          ? -BREAK_TERRAIN_PENALTY
          : 0;
      return { perfMod, sigmaMult: BREAK_SIGMA_MULT, roleMultiplier: ROLE_MULTIPLIER_DEFAULT };
    }

    case 'SPRINT_FINISH': {
      const perfMod = !isProtected
        ? 0
        : BUNCH_FINISH.includes(stageType)
          ? SPRINT_FINISH_BONUS
          : CLIMB_FINISH.includes(stageType)
            ? -SPRINT_FINISH_CLIMB_PENALTY
            : 0;
      return { perfMod, sigmaMult: 1, roleMultiplier: ROLE_MULTIPLIER_SPRINT };
    }

    case 'CONSERVE':
      return {
        perfMod: isProtected ? -CONSERVE_PENALTY : 0,
        sigmaMult: 1,
        roleMultiplier: ROLE_MULTIPLIER_CONSERVE,
      };
  }
}
