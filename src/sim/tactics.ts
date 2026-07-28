import {
  BREAK_PERF_BONUS,
  BREAK_SIGMA_MULT,
  BREAK_TERRAIN_PENALTY,
  CONSERVE_FATIGUE_MULT,
  CONSERVE_PERFORMANCE_PENALTY,
  DOMESTIQUE_SUPPORT_BONUS,
  DOMESTIQUE_SUPPORT_CAP,
  DOMESTIQUE_WORK_PENALTY,
  FREE_COORDINATION_LIMIT,
  FREE_CROWD_PENALTY,
  LEADER_BASE_BONUS,
  ROLE_FATIGUE_DOMESTIQUE,
  ROLE_FATIGUE_FREE,
  ROLE_FATIGUE_LEADER,
  ROLE_FATIGUE_SPRINTER,
  SPRINTER_BONUS,
  SPRINTER_CLIMB_PENALTY,
} from '../data/tuning.ts';
import type { StageType } from '../data/types.ts';

/**
 * Tactics (SPEC §5.5) — a ROLE PER RIDER, set before the stage. This replaces the
 * old "one protected rider + one team strategy": the whole team sheet is the
 * player's move. Roles are a data-driven registry (ROLES) so the palette can
 * widen without touching logic.
 *
 *   LEADER      backed for the win; gains from every DOMESTIQUE working for him
 *   SPRINTER    saved for a bunch kick — great on flat finishes, dropped on climbs
 *   BREAKAWAY   sent up the road: a non-favourite joins the morning break (and
 *               raises its survival odds); a favourite attacks late instead (§5.9)
 *   DOMESTIQUE  works for the leader — small penalty today, real fatigue later
 *   FREE        rides their own race, no strings
 */

// 'free' is the merged "ride your own race / go up the road / attack late" role —
// it absorbed the old separate 'breakaway' (they were indistinguishable in play).
export type TacticRole = 'leader' | 'sprinter' | 'domestique' | 'free';

/**
 * Team-wide effort for a stage (SPEC §5.8). Only meaningful in tours: 'conserve'
 * saves the team's legs for a later stage at the cost of the whole team's stage
 * ambition. A one-day race is always ridden 'race'.
 */
export type TeamEffort = 'race' | 'conserve';

export interface RoleDef {
  id: TacticRole;
  label: string; // player-facing
  short: string; // one letter for tight UI
  blurb: string;
  color: number; // chip colour in the UI
}

export const ROLES: RoleDef[] = [
  { id: 'leader', label: 'Leader', short: 'L', color: 0xf5c518, blurb: 'Backed for the win. Every domestique makes him stronger.' },
  { id: 'sprinter', label: 'Sprinter', short: 'S', color: 0x2ecc71, blurb: 'Sit in and unleash him in a bunch kick. Wasted on climbs.' },
  { id: 'free', label: 'Free / Attack', short: 'F', color: 0xe28f3b, blurb: 'Rides his own race — free to go up the road in the break, or attack late. The gamble.' },
  { id: 'domestique', label: 'Domestique', short: 'D', color: 0x4a90d9, blurb: 'Works for the leader. No result today, and tired legs tomorrow.' },
];

export const ROLES_BY_ID: Map<TacticRole, RoleDef> = new Map(ROLES.map((r) => [r.id, r]));

/** A team's stage tactics: a role for each of its riders (unlisted = FREE). */
export interface TeamTactics {
  teamId: string;
  roles: Record<string, TacticRole>; // riderId → role
  effort?: TeamEffort; // team-wide effort (tours only); defaults to 'race'
}

export function effortOf(tactics: TeamTactics | undefined): TeamEffort {
  return tactics?.effort ?? 'race';
}

export function roleOf(tactics: TeamTactics | undefined, riderId: string): TacticRole {
  return tactics?.roles[riderId] ?? 'free';
}

export interface RoleCounts {
  leaders: number;
  domestiques: number;
  frees: number;
}

export function roleCounts(tactics: TeamTactics | undefined): RoleCounts {
  const counts: RoleCounts = { leaders: 0, domestiques: 0, frees: 0 };
  if (!tactics) return counts;
  for (const role of Object.values(tactics.roles)) {
    if (role === 'leader') counts.leaders++;
    else if (role === 'domestique') counts.domestiques++;
    else if (role === 'free') counts.frees++;
  }
  return counts;
}

/** How a role modifies one rider's stage performance. */
export interface TacticsEffect {
  perfMod: number; // added to perfScore
  sigmaMult: number; // multiplies the form-swing sigma
  fatigueMult: number; // fatigue multiplier — consumed in Phase 3, exposed now
}

export interface EffortEffect {
  perfMod: number;
  fatigueMult: number;
  allowsCommittedMoves: boolean;
}

const BREAK_FRIENDLY: StageType[] = ['hilly', 'mountain', 'cobbled', 'descentFinish'];
const SPRINT_CONTROLLED: StageType[] = ['flat'];
export const BUNCH_FINISH: StageType[] = ['flat', 'hilly', 'cobbled'];
const CLIMB_FINISH: StageType[] = ['mountain', 'summitFinish'];

/**
 * Resolve the effect of one rider's role given the terrain, the team's role sheet
 * and the team's effort. Domestique support flows to leaders (split if a team
 * names several). Team effort is composed separately so it affects every rider.
 */
export function tacticsEffect(
  role: TacticRole,
  counts: RoleCounts,
  stageType: StageType,
  effort: TeamEffort = 'race',
): TacticsEffect {
  const base = roleEffect(role, counts, stageType);
  const teamEffort = effortEffect(effort);
  return {
    perfMod: base.perfMod + teamEffort.perfMod,
    sigmaMult: base.sigmaMult,
    fatigueMult: base.fatigueMult * teamEffort.fatigueMult,
  };
}

export function effortEffect(effort: TeamEffort): EffortEffect {
  return effort === 'conserve'
    ? { perfMod: -CONSERVE_PERFORMANCE_PENALTY, fatigueMult: CONSERVE_FATIGUE_MULT, allowsCommittedMoves: false }
    : { perfMod: 0, fatigueMult: 1, allowsCommittedMoves: true };
}

export function roleEffect(role: TacticRole, counts: RoleCounts, stageType: StageType): TacticsEffect {
  switch (role) {
    case 'leader': {
      const support = DOMESTIQUE_SUPPORT_BONUS * Math.min(counts.domestiques, DOMESTIQUE_SUPPORT_CAP);
      return {
        perfMod: LEADER_BASE_BONUS + support / Math.max(1, counts.leaders),
        sigmaMult: 1,
        fatigueMult: ROLE_FATIGUE_LEADER,
      };
    }
    case 'sprinter': {
      const perfMod = BUNCH_FINISH.includes(stageType)
        ? SPRINTER_BONUS
        : CLIMB_FINISH.includes(stageType)
          ? -SPRINTER_CLIMB_PENALTY
          : 0;
      return { perfMod, sigmaMult: 1, fatigueMult: ROLE_FATIGUE_SPRINTER };
    }
    case 'domestique':
      return { perfMod: -DOMESTIQUE_WORK_PENALTY, sigmaMult: 1, fatigueMult: ROLE_FATIGUE_DOMESTIQUE };
    case 'free': {
      // merged free/attack: the old breakaway effect — a perf edge on break-friendly
      // terrain (docked on a sprinters' flat), a wider form swing, an active day's fatigue
      const terrainMod = BREAK_FRIENDLY.includes(stageType)
        ? BREAK_PERF_BONUS
        : SPRINT_CONTROLLED.includes(stageType)
          ? -BREAK_TERRAIN_PENALTY
          : 0;
      // Attacking is a card you can only play so many times: a team can send a
      // couple of riders up the road, but "everyone attacks" has no one to set it
      // up, marks itself, and burns each other out. Each free rider past the
      // coordination limit docks EVERY free rider on the team — so a swarm of
      // attackers is a worse move than a focused one or two (SPEC §5.5, balance).
      const overcrowd = Math.max(0, counts.frees - FREE_COORDINATION_LIMIT);
      const crowdPenalty = overcrowd * FREE_CROWD_PENALTY;
      return { perfMod: terrainMod - crowdPenalty, sigmaMult: BREAK_SIGMA_MULT, fatigueMult: ROLE_FATIGUE_FREE };
    }
  }
}
