import type { Stage } from './types.ts';

/**
 * Minimal MVP stages (SPEC §4) — four different types so each rewards a different
 * specialist: flat→sprint, cobbled→puncheur/endurance, summitFinish→climbing,
 * itt→timeTrial. Proxy names (SPEC §9).
 */
export const STAGES: Stage[] = [
  { id: 'st-sanreno', name: 'Milan–Sanreno', type: 'flat', lengthKm: 294 },
  { id: 'st-roubey', name: 'Paris–Roubey', type: 'cobbled', lengthKm: 257 },
  { id: 'st-lombardo', name: 'Il Lombardo', type: 'summitFinish', lengthKm: 238 },
  { id: 'st-chrono', name: 'Chrono du Monde', type: 'itt', lengthKm: 44 },
];

export const STAGES_BY_ID: Map<string, Stage> = new Map(STAGES.map((s) => [s.id, s]));
