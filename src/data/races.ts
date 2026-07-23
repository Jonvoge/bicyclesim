import type { Race } from './types.ts';

/**
 * Races (SPEC §4, §6): one-day classics wrapping a single stage, plus a short
 * tour and a grand tour (Phase 3). Proxy names (SPEC §9); `prestige` is a
 * starting guess, unused until Phase 4.
 */
export const RACES: Race[] = [
  // --- one-day classics (prestige: Monuments ~90+, others 60–85) ---
  { id: 'r-omlopp', name: 'Omlopp Opening', type: 'oneDay', stageIds: ['st-omlopp'], prestige: 62 },
  { id: 'r-strada', name: 'Strada Bianca', type: 'oneDay', stageIds: ['st-strada'], prestige: 74 },
  { id: 'r-sanreno', name: 'Milan–Sanreno', type: 'oneDay', stageIds: ['st-sanreno'], prestige: 92 },
  { id: 'r-harburg', name: 'Harburg Classic', type: 'oneDay', stageIds: ['st-harburg'], prestige: 70 },
  { id: 'r-flandts', name: 'Ronde van Flandts', type: 'oneDay', stageIds: ['st-flandts'], prestige: 95 },
  { id: 'r-roubey', name: 'Paris–Roubey', type: 'oneDay', stageIds: ['st-roubey'], prestige: 95 },
  { id: 'r-amstal', name: 'Amstal Gold', type: 'oneDay', stageIds: ['st-amstal'], prestige: 78 },
  { id: 'r-fleche', name: 'Flèche Ardennaise', type: 'oneDay', stageIds: ['st-fleche'], prestige: 76 },
  { id: 'r-liege', name: 'Liège–Bastan', type: 'oneDay', stageIds: ['st-liege'], prestige: 92 },
  { id: 'r-donostia', name: 'Donostia Clásica', type: 'oneDay', stageIds: ['st-donostia'], prestige: 70 },
  { id: 'r-montagne', name: 'Grand Prix Montagne', type: 'oneDay', stageIds: ['st-montagne'], prestige: 66 },
  { id: 'r-lombardo', name: 'Il Lombardo', type: 'oneDay', stageIds: ['st-lombardo'], prestige: 90 },

  // --- stage races ---
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

/**
 * The season calendar (SPEC §6): the order races are contested through the year —
 * spring cobbles & classics, the Ardennes, then the grand tours, closing with the
 * autumn Monument. 14 events; the two tours span multiple race-days each.
 */
export const SEASON_CALENDAR: string[] = [
  'r-omlopp',
  'r-strada',
  'r-sanreno',
  'r-harburg',
  'r-flandts',
  'r-roubey',
  'r-amstal',
  'r-fleche',
  'r-liege',
  'r-provence',
  'r-donostia',
  'r-montagne',
  'r-aurelia',
  'r-lombardo',
];
