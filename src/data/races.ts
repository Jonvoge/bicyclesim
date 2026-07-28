import type { DivisionId, Race } from './types.ts';
import { PRO_RACE_FIELD_SIZE, WORLD_RACE_FIELD_SIZE, WORLD_WILDCARD_SLOTS } from './tuning.ts';

const worldEligibility = (wildcardSlots = 0): Race['eligibility'] => ({
  division: 'world',
  fieldSize: WORLD_RACE_FIELD_SIZE,
  wildcardSlots,
  divisionPointsScale: 1,
});

const proEligibility: Race['eligibility'] = {
  division: 'pro',
  fieldSize: PRO_RACE_FIELD_SIZE,
  divisionPointsScale: 1,
};

/**
 * Races (SPEC §4, §6): one-day classics wrapping a single stage, plus a short
 * tour and a grand tour (Phase 3). Proxy names (SPEC §9); `prestige` is a
 * starting guess, unused until Phase 4.
 */
export const RACES: Race[] = [
  // --- one-day classics (prestige: Monuments ~90+, others 60–85) ---
  { id: 'r-omlopp', name: 'Omlopp Opening', type: 'oneDay', stageIds: ['st-omlopp'], prestige: 62, eligibility: worldEligibility(WORLD_WILDCARD_SLOTS) },
  { id: 'r-strada', name: 'Strada Bianca', type: 'oneDay', stageIds: ['st-strada'], prestige: 74, eligibility: worldEligibility(WORLD_WILDCARD_SLOTS) },
  { id: 'r-sanreno', name: 'Milan–Sanreno', type: 'oneDay', stageIds: ['st-sanreno'], prestige: 92, eligibility: worldEligibility() },
  { id: 'r-harburg', name: 'Harburg Classic', type: 'oneDay', stageIds: ['st-harburg'], prestige: 70, eligibility: worldEligibility(WORLD_WILDCARD_SLOTS) },
  { id: 'r-flandts', name: 'Ronde van Flandts', type: 'oneDay', stageIds: ['st-flandts'], prestige: 95, eligibility: worldEligibility() },
  { id: 'r-roubey', name: 'Paris–Roubey', type: 'oneDay', stageIds: ['st-roubey'], prestige: 95, eligibility: worldEligibility() },
  { id: 'r-amstal', name: 'Amstal Gold', type: 'oneDay', stageIds: ['st-amstal'], prestige: 78, eligibility: worldEligibility(WORLD_WILDCARD_SLOTS) },
  { id: 'r-fleche', name: 'Flèche Ardennaise', type: 'oneDay', stageIds: ['st-fleche'], prestige: 76, eligibility: worldEligibility() },
  { id: 'r-liege', name: 'Liège–Bastan', type: 'oneDay', stageIds: ['st-liege'], prestige: 92, eligibility: worldEligibility() },
  { id: 'r-donostia', name: 'Donostia Clásica', type: 'oneDay', stageIds: ['st-donostia'], prestige: 70, eligibility: worldEligibility(WORLD_WILDCARD_SLOTS) },
  { id: 'r-montagne', name: 'Grand Prix Montagne', type: 'oneDay', stageIds: ['st-montagne'], prestige: 66, eligibility: worldEligibility(WORLD_WILDCARD_SLOTS) },
  { id: 'r-montreol', name: 'Montréol Classic', type: 'oneDay', stageIds: ['st-montreol'], prestige: 68, eligibility: worldEligibility(WORLD_WILDCARD_SLOTS) },
  { id: 'r-rainbow', name: 'Rainbow Championship', type: 'oneDay', stageIds: ['st-rainbow'], prestige: 93, eligibility: worldEligibility() },
  { id: 'r-lombardo', name: 'Il Lombardo', type: 'oneDay', stageIds: ['st-lombardo'], prestige: 90, eligibility: worldEligibility() },

  // --- stage races ---
  {
    id: 'r-provence',
    name: 'Tour de Provence',
    type: 'shortTour',
    stageIds: ['tp-1', 'tp-2', 'tp-3', 'tp-4', 'tp-5'],
    prestige: 88,
    eligibility: worldEligibility(WORLD_WILDCARD_SLOTS),
  },
  {
    id: 'r-aurelia',
    name: "Giro d'Aurelia",
    type: 'grandTour',
    stageIds: ['ga-1', 'ga-2', 'ga-3', 'ga-4', 'ga-5', 'ga-6', 'ga-7', 'ga-8', 'ga-9'],
    prestige: 100,
    eligibility: worldEligibility(),
  },
  {
    id: 'r-iberia',
    name: 'Vuelta a Iberia',
    type: 'shortTour',
    stageIds: ['vi-1', 'vi-2', 'vi-3', 'vi-4', 'vi-5'],
    prestige: 86,
    eligibility: worldEligibility(),
  },

  { id: 'pr-coast', name: 'Coastal Wind Race', type: 'oneDay', stageIds: ['pro-coast'], prestige: 46, eligibility: proEligibility },
  { id: 'pr-quarry', name: 'Old Quarry Classic', type: 'oneDay', stageIds: ['pro-quarry'], prestige: 52, eligibility: proEligibility },
  { id: 'pr-orchard', name: 'Orchard Hills', type: 'oneDay', stageIds: ['pro-orchard'], prestige: 48, eligibility: proEligibility },
  { id: 'pr-lakes', name: 'Lake District Trophy', type: 'oneDay', stageIds: ['pro-lakes'], prestige: 55, eligibility: proEligibility },
  { id: 'pr-ridge', name: 'High Ridge Challenge', type: 'oneDay', stageIds: ['pro-ridge'], prestige: 58, eligibility: proEligibility },
  { id: 'pr-port', name: 'Port City Sprint', type: 'oneDay', stageIds: ['pro-port'], prestige: 44, eligibility: proEligibility },
  { id: 'pr-stones', name: 'Northern Stones', type: 'oneDay', stageIds: ['pro-stones'], prestige: 56, eligibility: proEligibility },
  { id: 'pr-vineyard', name: 'Vineyard Wall', type: 'oneDay', stageIds: ['pro-vineyard'], prestige: 62, eligibility: proEligibility },
  { id: 'pr-forest', name: 'Forest Circuit', type: 'oneDay', stageIds: ['pro-forest'], prestige: 50, eligibility: proEligibility },
  { id: 'pr-harbor', name: 'Harbor Finale', type: 'oneDay', stageIds: ['pro-harbor'], prestige: 60, eligibility: proEligibility },
  { id: 'pr-valley', name: 'Valley Tour', type: 'shortTour', stageIds: ['pt-valley-1', 'pt-valley-2', 'pt-valley-3', 'pt-valley-4'], prestige: 68, eligibility: proEligibility },
  { id: 'pr-lowlands', name: 'Lowlands Tour', type: 'shortTour', stageIds: ['pt-lowlands-1', 'pt-lowlands-2', 'pt-lowlands-3', 'pt-lowlands-4'], prestige: 66, eligibility: proEligibility },
  { id: 'pr-peaks', name: 'Three Peaks Tour', type: 'shortTour', stageIds: ['pt-peaks-1', 'pt-peaks-2', 'pt-peaks-3', 'pt-peaks-4'], prestige: 72, eligibility: proEligibility },
];

export const RACES_BY_ID: Map<string, Race> = new Map(RACES.map((r) => [r.id, r]));

/**
 * The season calendar (SPEC §6): the order races are contested through the year, in
 * three balanced windows so a Season Focus plan (docs/cycling-sim-SEASON-FOCUS.md)
 * has real targets whenever it peaks:
 *   Spring  (1–9)   cobbles, classics & the Ardennes
 *   Summer  (10–13) the grand tours
 *   Autumn  (14–17) a late climber's tour, two autumn one-days & the closing Monument
 * 17 events; the three tours span multiple race-days each.
 */
export const WORLD_CALENDAR: string[] = [
  // spring
  'r-omlopp',
  'r-strada',
  'r-sanreno',
  'r-harburg',
  'r-flandts',
  'r-roubey',
  'r-amstal',
  'r-fleche',
  'r-liege',
  // summer
  'r-provence',
  'r-donostia',
  'r-montagne',
  'r-aurelia',
  // autumn
  'r-iberia',
  'r-montreol',
  'r-rainbow',
  'r-lombardo',
];

export const PRO_CALENDAR: string[] = [
  'pr-coast',
  'pr-quarry',
  'pr-valley',
  'pr-orchard',
  'pr-port',
  'pr-lowlands',
  'pr-lakes',
  'pr-ridge',
  'pr-stones',
  'pr-peaks',
  'pr-vineyard',
  'pr-forest',
  'pr-harbor',
];

/** Legacy authored saves and Quick Race retain the original World calendar. */
export const SEASON_CALENDAR = WORLD_CALENDAR;

export function calendarForDivision(division: DivisionId): readonly string[] {
  return division === 'world' ? WORLD_CALENDAR : PRO_CALENDAR;
}
