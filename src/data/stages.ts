import type { Stage } from './types.ts';

const WORLD_ELEVATION_PROFILES: Readonly<Record<string, readonly number[]>> = {
  // Spring classics: recognizable route rhythm rather than generic terrain art.
  'st-omlopp': [0.08, 0.1, 0.08, 0.13, 0.1, 0.2, 0.12, 0.27, 0.15, 0.33, 0.18, 0.38, 0.19, 0.29, 0.12, 0.08],
  'st-strada': [0.12, 0.2, 0.16, 0.29, 0.19, 0.38, 0.22, 0.45, 0.27, 0.5, 0.3, 0.58, 0.35, 0.67, 0.42, 0.78],
  'st-sanreno': [0.08, 0.09, 0.08, 0.1, 0.08, 0.11, 0.09, 0.13, 0.1, 0.16, 0.11, 0.27, 0.13, 0.36, 0.16, 0.08],
  'st-harburg': [0.1, 0.12, 0.09, 0.2, 0.12, 0.28, 0.15, 0.35, 0.19, 0.42, 0.21, 0.37, 0.18, 0.32, 0.14, 0.09],
  'st-flandts': [0.09, 0.12, 0.1, 0.18, 0.13, 0.25, 0.15, 0.32, 0.18, 0.41, 0.2, 0.48, 0.23, 0.53, 0.18, 0.09],
  'st-roubey': [0.08, 0.1, 0.08, 0.14, 0.09, 0.17, 0.1, 0.2, 0.11, 0.18, 0.09, 0.16, 0.1, 0.14, 0.09, 0.08],
  'st-amstal': [0.12, 0.23, 0.14, 0.32, 0.17, 0.39, 0.2, 0.46, 0.25, 0.5, 0.28, 0.44, 0.22, 0.48, 0.26, 0.16],
  'st-fleche': [0.12, 0.22, 0.14, 0.3, 0.17, 0.36, 0.2, 0.42, 0.23, 0.48, 0.27, 0.39, 0.22, 0.34, 0.28, 0.96],
  'st-liege': [0.1, 0.17, 0.12, 0.31, 0.16, 0.43, 0.2, 0.5, 0.24, 0.57, 0.28, 0.62, 0.31, 0.55, 0.24, 0.12],
  'st-donostia': [0.1, 0.18, 0.35, 0.17, 0.45, 0.23, 0.58, 0.3, 0.68, 0.34, 0.75, 0.4, 0.59, 0.32, 0.18, 0.09],
  'st-montagne': [0.11, 0.2, 0.48, 0.24, 0.6, 0.31, 0.7, 0.38, 0.76, 0.43, 0.64, 0.35, 0.55, 0.28, 0.4, 0.16],
  'st-montreol': [0.13, 0.32, 0.16, 0.36, 0.18, 0.4, 0.2, 0.44, 0.22, 0.48, 0.24, 0.51, 0.27, 0.46, 0.22, 0.12],
  'st-rainbow': [0.12, 0.27, 0.15, 0.33, 0.18, 0.39, 0.21, 0.45, 0.24, 0.5, 0.28, 0.55, 0.31, 0.49, 0.24, 0.11],
  'st-lombardo': [0.1, 0.2, 0.48, 0.25, 0.63, 0.34, 0.78, 0.42, 0.69, 0.37, 0.84, 0.48, 0.66, 0.32, 0.17, 0.08],

  // Condensed stage-race routes preserve the signature mix of each real tour.
  'tp-1': [0.08, 0.1, 0.09, 0.13, 0.1, 0.16, 0.11, 0.18, 0.12, 0.16, 0.1, 0.08],
  'tp-2': [0.1, 0.14, 0.1, 0.2, 0.12, 0.26, 0.15, 0.31, 0.18, 0.27, 0.14, 0.09],
  'tp-3': [0.11, 0.24, 0.15, 0.36, 0.19, 0.43, 0.23, 0.5, 0.28, 0.42, 0.22, 0.13],
  'tp-4': [0.1, 0.18, 0.51, 0.27, 0.66, 0.38, 0.78, 0.46, 0.7, 0.39, 0.54, 0.2],
  'tp-5': [0.1, 0.17, 0.13, 0.3, 0.22, 0.43, 0.35, 0.55, 0.65, 0.78, 0.9, 1],
  'ga-1': [0.08, 0.1, 0.09, 0.12, 0.1, 0.15, 0.11, 0.13, 0.09, 0.11, 0.08, 0.07],
  'ga-2': [0.1, 0.21, 0.14, 0.32, 0.18, 0.4, 0.24, 0.48, 0.27, 0.39, 0.2, 0.1],
  'ga-3': [0.08, 0.12, 0.09, 0.18, 0.11, 0.23, 0.13, 0.27, 0.15, 0.22, 0.12, 0.08],
  'ga-4': [0.09, 0.12, 0.1, 0.14, 0.11, 0.18, 0.13, 0.16, 0.11, 0.13, 0.09, 0.08],
  'ga-5': [0.11, 0.2, 0.48, 0.25, 0.63, 0.34, 0.74, 0.4, 0.81, 0.51, 0.68, 0.3],
  'ga-6': [0.1, 0.22, 0.51, 0.72, 0.9, 0.75, 0.56, 0.68, 0.42, 0.27, 0.15, 0.08],
  'ga-7': [0.12, 0.25, 0.16, 0.37, 0.2, 0.45, 0.24, 0.52, 0.29, 0.43, 0.23, 0.12],
  'ga-8': [0.1, 0.19, 0.55, 0.31, 0.7, 0.42, 0.82, 0.5, 0.76, 0.44, 0.61, 0.25],
  'ga-9': [0.1, 0.16, 0.12, 0.25, 0.2, 0.36, 0.3, 0.48, 0.61, 0.75, 0.9, 1],
  'vi-1': [0.08, 0.11, 0.09, 0.14, 0.1, 0.17, 0.12, 0.15, 0.1, 0.12, 0.09, 0.07],
  'vi-2': [0.11, 0.23, 0.15, 0.35, 0.19, 0.42, 0.24, 0.49, 0.28, 0.4, 0.21, 0.11],
  'vi-3': [0.1, 0.18, 0.14, 0.28, 0.22, 0.39, 0.33, 0.5, 0.63, 0.77, 0.91, 1],
  'vi-4': [0.1, 0.21, 0.56, 0.3, 0.71, 0.4, 0.82, 0.51, 0.73, 0.42, 0.59, 0.22],
  'vi-5': [0.1, 0.17, 0.13, 0.31, 0.24, 0.44, 0.36, 0.56, 0.67, 0.8, 0.92, 1],
};

/**
 * Stages (SPEC §4, §6). Each terrain rewards a different specialist and race
 * shape: flat→sprint bunch, hilly→puncheur, cobbled→puncheur/endurance,
 * mountain/summitFinish→climbing, descentFinish→a daring plunge. One-day classics
 * plus the stages of the two tours. Proxy names only (SPEC §9).
 */
const STAGE_ROUTES: Stage[] = [
  // --- one-day classics (each wrapped as a one-day Race) ---
  { id: 'st-omlopp', name: 'Omlopp Opening', type: 'cobbled', lengthKm: 202 },
  { id: 'st-strada', name: 'Strada Bianca', type: 'hilly', lengthKm: 213 },
  { id: 'st-sanreno', name: 'Milan–Sanreno', type: 'flat', lengthKm: 289 },
  { id: 'st-harburg', name: 'Harburg Classic', type: 'cobbled', lengthKm: 208 },
  { id: 'st-flandts', name: 'Ronde van Flandts', type: 'cobbled', lengthKm: 269 },
  { id: 'st-roubey', name: 'Paris–Roubey', type: 'cobbled', lengthKm: 259 },
  { id: 'st-amstal', name: 'Amstal Gold', type: 'hilly', lengthKm: 255 },
  { id: 'st-fleche', name: 'Flèche Ardennaise', type: 'hilly', lengthKm: 205 },
  { id: 'st-liege', name: 'Liège–Bastan', type: 'summitFinish', lengthKm: 252 },
  { id: 'st-donostia', name: 'Donostia Clásica', type: 'hilly', lengthKm: 236 },
  { id: 'st-montagne', name: 'Grand Prix Montagne', type: 'mountain', lengthKm: 196 },
  { id: 'st-montreol', name: 'Montréol Classic', type: 'hilly', lengthKm: 209 },
  { id: 'st-rainbow', name: 'Rainbow Championship', type: 'hilly', lengthKm: 274 },
  { id: 'st-lombardo', name: 'Il Lombardo', type: 'summitFinish', lengthKm: 252 },

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

  // --- Vuelta a Iberia (short tour, 5 stages): a late-summer climber's race —
  //     a sprint opener then a relentless run of mountains and summit finishes,
  //     the GC target for a Grand Tour plan distinct from the Giro d'Aurelia ---
  { id: 'vi-1', name: 'Iberia · Stage 1', type: 'flat', lengthKm: 182 },
  { id: 'vi-2', name: 'Iberia · Stage 2', type: 'hilly', lengthKm: 174 },
  { id: 'vi-3', name: 'Iberia · Stage 3', type: 'summitFinish', lengthKm: 166 },
  { id: 'vi-4', name: 'Iberia · Stage 4', type: 'mountain', lengthKm: 188 },
  { id: 'vi-5', name: 'Iberia · Stage 5', type: 'summitFinish', lengthKm: 159 },

  // --- Pro Tour: a separate regional calendar with shorter, varied routes ---
  { id: 'pro-coast', name: 'Coastal Wind Race', type: 'flat', lengthKm: 174 },
  { id: 'pro-quarry', name: 'Old Quarry Classic', type: 'cobbled', lengthKm: 181 },
  { id: 'pro-orchard', name: 'Orchard Hills', type: 'hilly', lengthKm: 169 },
  { id: 'pro-lakes', name: 'Lake District Trophy', type: 'hilly', lengthKm: 192 },
  { id: 'pro-ridge', name: 'High Ridge Challenge', type: 'mountain', lengthKm: 176 },
  { id: 'pro-port', name: 'Port City Sprint', type: 'flat', lengthKm: 188 },
  { id: 'pro-stones', name: 'Northern Stones', type: 'cobbled', lengthKm: 196 },
  { id: 'pro-vineyard', name: 'Vineyard Wall', type: 'summitFinish', lengthKm: 164 },
  { id: 'pro-forest', name: 'Forest Circuit', type: 'hilly', lengthKm: 183 },
  { id: 'pro-harbor', name: 'Harbor Finale', type: 'flat', lengthKm: 201 },

  { id: 'pt-valley-1', name: 'Valley Tour · Stage 1', type: 'flat', lengthKm: 158 },
  { id: 'pt-valley-2', name: 'Valley Tour · Stage 2', type: 'hilly', lengthKm: 172 },
  { id: 'pt-valley-3', name: 'Valley Tour · Stage 3', type: 'mountain', lengthKm: 166 },
  { id: 'pt-valley-4', name: 'Valley Tour · Stage 4', type: 'summitFinish', lengthKm: 148 },

  { id: 'pt-lowlands-1', name: 'Lowlands Tour · Stage 1', type: 'flat', lengthKm: 181 },
  { id: 'pt-lowlands-2', name: 'Lowlands Tour · Stage 2', type: 'cobbled', lengthKm: 154 },
  { id: 'pt-lowlands-3', name: 'Lowlands Tour · Stage 3', type: 'hilly', lengthKm: 177 },
  { id: 'pt-lowlands-4', name: 'Lowlands Tour · Stage 4', type: 'flat', lengthKm: 169 },

  { id: 'pt-peaks-1', name: 'Three Peaks Tour · Stage 1', type: 'hilly', lengthKm: 163 },
  { id: 'pt-peaks-2', name: 'Three Peaks Tour · Stage 2', type: 'mountain', lengthKm: 171 },
  { id: 'pt-peaks-3', name: 'Three Peaks Tour · Stage 3', type: 'descentFinish', lengthKm: 184 },
  { id: 'pt-peaks-4', name: 'Three Peaks Tour · Stage 4', type: 'summitFinish', lengthKm: 152 },
];

export const STAGES: Stage[] = STAGE_ROUTES.map((stage) => ({
  ...stage,
  elevationProfile: WORLD_ELEVATION_PROFILES[stage.id],
}));

export const STAGES_BY_ID: Map<string, Stage> = new Map(STAGES.map((s) => [s.id, s]));
