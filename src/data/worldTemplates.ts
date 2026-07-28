import type { BaseStatKey, TeamPhilosophy } from './types.ts';

export type RiderArchetype =
  | 'gcClimber'
  | 'pureClimber'
  | 'puncheur'
  | 'rouleur'
  | 'sprinter'
  | 'leadout'
  | 'breakaway'
  | 'domestique';

export const ARCHETYPE_PROFILES: Record<RiderArchetype, Record<BaseStatKey, number>> = {
  gcClimber: { climbing: 1, flat: 0.35, sprint: 0.12, puncheur: 0.62, endurance: 0.88 },
  pureClimber: { climbing: 1, flat: 0.18, sprint: 0.08, puncheur: 0.5, endurance: 0.72 },
  puncheur: { climbing: 0.55, flat: 0.5, sprint: 0.48, puncheur: 1, endurance: 0.66 },
  rouleur: { climbing: 0.2, flat: 1, sprint: 0.42, puncheur: 0.6, endurance: 0.8 },
  sprinter: { climbing: 0.08, flat: 0.66, sprint: 1, puncheur: 0.34, endurance: 0.48 },
  leadout: { climbing: 0.14, flat: 0.82, sprint: 0.78, puncheur: 0.42, endurance: 0.64 },
  breakaway: { climbing: 0.48, flat: 0.76, sprint: 0.34, puncheur: 0.72, endurance: 0.82 },
  domestique: { climbing: 0.48, flat: 0.6, sprint: 0.25, puncheur: 0.5, endurance: 0.76 },
};

export const PHILOSOPHY_ROSTERS: Record<TeamPhilosophy, RiderArchetype[]> = {
  mountain: ['gcClimber', 'pureClimber', 'puncheur', 'breakaway', 'domestique', 'domestique', 'rouleur', 'leadout'],
  classics: ['puncheur', 'rouleur', 'breakaway', 'puncheur', 'leadout', 'domestique', 'domestique', 'pureClimber'],
  sprint: ['sprinter', 'leadout', 'leadout', 'rouleur', 'puncheur', 'domestique', 'domestique', 'pureClimber'],
  development: ['gcClimber', 'puncheur', 'sprinter', 'rouleur', 'breakaway', 'domestique', 'domestique', 'leadout'],
  balanced: ['gcClimber', 'sprinter', 'puncheur', 'rouleur', 'breakaway', 'leadout', 'domestique', 'domestique'],
  opportunist: ['breakaway', 'puncheur', 'rouleur', 'pureClimber', 'sprinter', 'domestique', 'domestique', 'leadout'],
};

export const AI_PHILOSOPHIES: TeamPhilosophy[] = ['mountain', 'classics', 'sprint', 'development', 'opportunist', 'balanced'];