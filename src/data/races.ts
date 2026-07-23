import type { Race } from './types.ts';

/**
 * Minimal MVP races (SPEC §4) — each a one-day race wrapping a single stage.
 * Multi-stage tours arrive in Phase 3. Proxy names (SPEC §9); `prestige` is a
 * starting guess, unused until Phase 4.
 */
export const RACES: Race[] = [
  { id: 'r-sanreno', name: 'Milan–Sanreno', type: 'oneDay', stageIds: ['st-sanreno'], prestige: 80 },
  { id: 'r-fleche', name: 'Flèche Ardennaise', type: 'oneDay', stageIds: ['st-fleche'], prestige: 72 },
  { id: 'r-roubey', name: 'Paris–Roubey', type: 'oneDay', stageIds: ['st-roubey'], prestige: 85 },
  { id: 'r-lombardo', name: 'Il Lombardo', type: 'oneDay', stageIds: ['st-lombardo'], prestige: 75 },
];

export const RACES_BY_ID: Map<string, Race> = new Map(RACES.map((r) => [r.id, r]));
