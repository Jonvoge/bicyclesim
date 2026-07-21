import {
  ALL_IN_HELPER_PENALTY,
  CONSERVE_PENALTY,
  HUNT_STAGE_SIGMA_MULT,
  LEADER_BONUS,
  ROLE_MULTIPLIER_ALL_IN,
  ROLE_MULTIPLIER_CONSERVE,
  ROLE_MULTIPLIER_DEFAULT,
} from '../data/tuning.ts';

/**
 * Tactics (SPEC §5.5).
 *
 * Before each stage the player picks a protected rider + a strategy. The trade-off
 * IS the game: spending the team for a leader today costs stamina tomorrow.
 */

export type Strategy = 'ALL_IN_LEADER' | 'HUNT_STAGE' | 'CONSERVE';

export const STRATEGIES: Strategy[] = ['ALL_IN_LEADER', 'HUNT_STAGE', 'CONSERVE'];

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

const NEUTRAL: TacticsEffect = {
  perfMod: 0,
  sigmaMult: 1,
  roleMultiplier: ROLE_MULTIPLIER_DEFAULT,
};

/**
 * Resolve the effect for a single rider given their team's tactics.
 * `isProtected` = this rider is the one the team rides for today.
 */
export function tacticsEffect(
  tactics: TeamTactics | undefined,
  isProtected: boolean,
): TacticsEffect {
  if (!tactics) return NEUTRAL;

  switch (tactics.strategy) {
    case 'ALL_IN_LEADER':
      return isProtected
        ? { perfMod: LEADER_BONUS, sigmaMult: 1, roleMultiplier: ROLE_MULTIPLIER_DEFAULT }
        : {
            perfMod: -ALL_IN_HELPER_PENALTY,
            sigmaMult: 1,
            roleMultiplier: ROLE_MULTIPLIER_ALL_IN,
          };

    case 'HUNT_STAGE':
      // No single leader; the whole team races aggressively → wider swing.
      return {
        perfMod: 0,
        sigmaMult: HUNT_STAGE_SIGMA_MULT,
        roleMultiplier: ROLE_MULTIPLIER_DEFAULT,
      };

    case 'CONSERVE':
      // Everyone saves for later; the protected rider takes a small edge off.
      return {
        perfMod: isProtected ? -CONSERVE_PENALTY : 0,
        sigmaMult: 1,
        roleMultiplier: ROLE_MULTIPLIER_CONSERVE,
      };
  }
}
