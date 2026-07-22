import type { Stage } from './types.ts';

/**
 * Minimal MVP stages (SPEC §4) — four different types so each rewards a different
 * specialist and race shape: flat→sprint bunch, hilly→puncheur, cobbled→
 * puncheur/endurance, summitFinish→climbing. Proxy names (SPEC §9).
 */
export const STAGES: Stage[] = [
  { id: 'st-sanreno', name: 'Milan–Sanreno', type: 'flat', lengthKm: 294 },
  { id: 'st-fleche', name: 'Flèche Ardennaise', type: 'hilly', lengthKm: 205 },
  { id: 'st-roubey', name: 'Paris–Roubey', type: 'cobbled', lengthKm: 257 },
  { id: 'st-lombardo', name: 'Il Lombardo', type: 'summitFinish', lengthKm: 238 },
];

export const STAGES_BY_ID: Map<string, Stage> = new Map(STAGES.map((s) => [s.id, s]));
