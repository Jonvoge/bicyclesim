import type { Race } from './types.ts';

/**
 * Races (SPEC §4, §6): one-day classics wrapping a single stage, plus a short
 * tour and a grand tour (Phase 3). Proxy names (SPEC §9); `prestige` is a
 * starting guess, unused until Phase 4.
 */
export const RACES: Race[] = [
  { id: 'r-sanreno', name: 'Milan–Sanreno', type: 'oneDay', stageIds: ['st-sanreno'], prestige: 80 },
  { id: 'r-fleche', name: 'Flèche Ardennaise', type: 'oneDay', stageIds: ['st-fleche'], prestige: 72 },
  { id: 'r-roubey', name: 'Paris–Roubey', type: 'oneDay', stageIds: ['st-roubey'], prestige: 85 },
  { id: 'r-lombardo', name: 'Il Lombardo', type: 'oneDay', stageIds: ['st-lombardo'], prestige: 75 },
  {
    id: 'r-provence',
    name: 'Tour de Provence',
    type: 'shortTour',
    stageIds: ['tp-1', 'tp-2', 'tp-3', 'tp-4', 'tp-5'],
    prestige: 88,
  },
  {
    id: 'r-aurelia',
    name: "Giro d'Aurelia",
    type: 'grandTour',
    stageIds: ['ga-1', 'ga-2', 'ga-3', 'ga-4', 'ga-5', 'ga-6', 'ga-7', 'ga-8', 'ga-9'],
    prestige: 100,
  },
];

export const RACES_BY_ID: Map<string, Race> = new Map(RACES.map((r) => [r.id, r]));
