import type { Stage } from './types.ts';

/**
 * Stages (SPEC §4, §6). Each terrain rewards a different specialist and race
 * shape: flat→sprint bunch, hilly→puncheur, cobbled→puncheur/endurance,
 * mountain/summitFinish→climbing, descentFinish→a daring plunge. One-day classics
 * plus the stages of the two tours. Proxy names only (SPEC §9).
 */
export const STAGES: Stage[] = [
  // --- one-day classics (each wrapped as a one-day Race) ---
  { id: 'st-omlopp', name: 'Omlopp Opening', type: 'cobbled', lengthKm: 200 },
  { id: 'st-strada', name: 'Strada Bianca', type: 'hilly', lengthKm: 184 },
  { id: 'st-sanreno', name: 'Milan–Sanreno', type: 'flat', lengthKm: 294 },
  { id: 'st-harburg', name: 'Harburg Classic', type: 'cobbled', lengthKm: 204 },
  { id: 'st-flandts', name: 'Ronde van Flandts', type: 'cobbled', lengthKm: 267 },
  { id: 'st-roubey', name: 'Paris–Roubey', type: 'cobbled', lengthKm: 257 },
  { id: 'st-amstal', name: 'Amstal Gold', type: 'hilly', lengthKm: 254 },
  { id: 'st-fleche', name: 'Flèche Ardennaise', type: 'hilly', lengthKm: 205 },
  { id: 'st-liege', name: 'Liège–Bastan', type: 'summitFinish', lengthKm: 258 },
  { id: 'st-donostia', name: 'Donostia Clásica', type: 'hilly', lengthKm: 227 },
  { id: 'st-montagne', name: 'Grand Prix Montagne', type: 'mountain', lengthKm: 196 },
  { id: 'st-lombardo', name: 'Il Lombardo', type: 'summitFinish', lengthKm: 238 },

  // --- Tour de Provence (short tour, 5 stages): a sprint opener, cobbles, two
  //     mountain days around a hilly stage — GC decided in the second half ---
  { id: 'tp-1', name: 'Provence · Stage 1', type: 'flat', lengthKm: 178 },
  { id: 'tp-2', name: 'Provence · Stage 2', type: 'cobbled', lengthKm: 156 },
  { id: 'tp-3', name: 'Provence · Stage 3', type: 'hilly', lengthKm: 192 },
  { id: 'tp-4', name: 'Provence · Stage 4', type: 'mountain', lengthKm: 168 },
  { id: 'tp-5', name: 'Provence · Stage 5', type: 'summitFinish', lengthKm: 174 },

  // --- Giro d'Aurelia (grand tour, 9 stages): sprints, a descent finish, a
  //     cobbled ambush, and three high-mountain days that build to a summit ---
  { id: 'ga-1', name: "Aurelia · Stage 1", type: 'flat', lengthKm: 201 },
  { id: 'ga-2', name: "Aurelia · Stage 2", type: 'hilly', lengthKm: 188 },
  { id: 'ga-3', name: "Aurelia · Stage 3", type: 'cobbled', lengthKm: 162 },
  { id: 'ga-4', name: "Aurelia · Stage 4", type: 'flat', lengthKm: 214 },
  { id: 'ga-5', name: "Aurelia · Stage 5", type: 'mountain', lengthKm: 176 },
  { id: 'ga-6', name: "Aurelia · Stage 6", type: 'descentFinish', lengthKm: 183 },
  { id: 'ga-7', name: "Aurelia · Stage 7", type: 'hilly', lengthKm: 197 },
  { id: 'ga-8', name: "Aurelia · Stage 8", type: 'mountain', lengthKm: 169 },
  { id: 'ga-9', name: "Aurelia · Stage 9", type: 'summitFinish', lengthKm: 158 },
];

export const STAGES_BY_ID: Map<string, Stage> = new Map(STAGES.map((s) => [s.id, s]));
