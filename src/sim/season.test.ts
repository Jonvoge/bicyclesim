import { describe, expect, it } from 'vitest';

import { RACES_BY_ID } from '../data/races.ts';
import { RIDERS, RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { TEAMS } from '../data/teams.ts';
import type { Rider } from '../data/types.ts';
import { Rng } from './rng.ts';
import { buildRaceStory } from './raceNarrative.ts';
import { defaultTeamTactics } from './raceSetup.ts';
import { isTourComplete, recordStageResult, ridersForStage } from './standings.ts';
import {
  createSeason,
  currentRace,
  finishEvent,
  isSeasonComplete,
  riderStandings,
  startEvent,
  teamStandings,
  type SeasonState,
} from './season.ts';

const CALENDAR = ['r-sanreno', 'r-lombardo', 'r-provence']; // flat, summit, a 5-stage tour

/** Play the current event to the finish under a seed; returns the season result. */
function playEvent(season: SeasonState, seed: number, startList: Rider[] = RIDERS) {
  const tour = startEvent(season, startList);
  const rng = new Rng(seed);
  while (!isTourComplete(tour)) {
    const stage = STAGES_BY_ID.get(tour.stageIds[tour.stageIndex])!;
    const riders = ridersForStage(tour, startList);
    const tactics = new Map(TEAMS.map((t) => [t.id, defaultTeamTactics(t, stage)]));
    const story = buildRaceStory({ stage, riders, tacticsByTeam: tactics, rng });
    recordStageResult(tour, stage, story.result, tactics, riders);
  }
  return finishEvent(season, tour, RIDERS);
}

function playSeason(seed: number): SeasonState {
  const season = createSeason(CALENDAR);
  let i = 0;
  while (!isSeasonComplete(season)) playEvent(season, seed + i++ * 1000);
  return season;
}

describe('season calendar', () => {
  it('advances through the calendar and completes', () => {
    const season = createSeason(CALENDAR);
    expect(currentRace(season)!.id).toBe('r-sanreno');
    playEvent(season, 1);
    expect(currentRace(season)!.id).toBe('r-lombardo');
    playEvent(season, 2);
    playEvent(season, 3);
    expect(isSeasonComplete(season)).toBe(true);
    expect(currentRace(season)).toBeNull();
    expect(season.results.map((r) => r.raceId)).toEqual(CALENDAR);
  });

  it('is deterministic under a seed', () => {
    const a = riderStandings(playSeason(42));
    const b = riderStandings(playSeason(42));
    expect(a).toEqual(b);
  });
});

describe('season points', () => {
  it('awards the winner the most points, scaled by race prestige', () => {
    const season = createSeason(CALENDAR);
    const res = playEvent(season, 7);
    const winnerPts = season.points.get(res.winnerId)!;
    // winner got the top slot × prestige/100
    const prestige = RACES_BY_ID.get('r-sanreno')!.prestige;
    expect(winnerPts).toBe(Math.round((100 * prestige) / 100));
    // and no one has more than the winner
    expect(Math.max(...season.points.values())).toBe(winnerPts);
  });

  it('a more prestigious race is worth more to its winner', () => {
    // same flat sprint, different prestige → compare winner payouts
    const monument = createSeason(['r-sanreno']); // prestige 92
    const minor = createSeason(['r-omlopp']); // prestige 62
    const wA = playEvent(monument, 3);
    const wB = playEvent(minor, 3);
    expect(monument.points.get(wA.winnerId)!).toBeGreaterThan(minor.points.get(wB.winnerId)!);
  });

  it('ranks riders and teams by total points', () => {
    const season = playSeason(11);
    const riders = riderStandings(season);
    for (let i = 1; i < riders.length; i++) expect(riders[i - 1].points).toBeGreaterThanOrEqual(riders[i].points);
    const teams = teamStandings(season, (id) => RIDERS_BY_ID.get(id)?.teamId ?? null);
    // every team scores something across a full season, sorted desc
    expect(teams.length).toBe(TEAMS.length);
    for (let i = 1; i < teams.length; i++) expect(teams[i - 1].points).toBeGreaterThanOrEqual(teams[i].points);
    // team totals equal the sum of their riders' points
    const total = [...season.points.values()].reduce((a, b) => a + b, 0);
    expect(teams.reduce((a, t) => a + t.points, 0)).toBe(total);
  });
});

describe('fatigue carries across the season', () => {
  it('a rider who races the tour carries fatigue into the next event; a rested rider is fresher', () => {
    const season = createSeason(['r-aurelia', 'r-sanreno']); // a 9-stage tour, then a flat day
    // race everyone through the grand tour EXCEPT one rider we hold back
    const rested = 'gr-kobbel';
    const startList = RIDERS.filter((r) => r.id !== rested);
    playEvent(season, 5, startList);
    // the rested rider carried 0 fatigue and still recovers toward 0
    expect(season.fatigue.get(rested) ?? 0).toBe(0);
    // a rider who rode the whole tour is carrying real fatigue into the next race
    const worked = season.fatigue.get('gr-pogar') ?? 0;
    expect(worked).toBeGreaterThan(0);
  });

  it('fatigue recovers between races (a rider left idle trends back toward fresh)', () => {
    const season = createSeason(['r-aurelia', 'r-sanreno', 'r-lombardo']);
    playEvent(season, 9); // everyone rides the grand tour → fatigued
    const afterTour = season.fatigue.get('gr-pogar')!;
    // now sit Pogar out of the next two events; his fatigue should decay
    const noPogar = RIDERS.filter((r) => r.id !== 'gr-pogar');
    playEvent(season, 10, noPogar);
    const afterRest = season.fatigue.get('gr-pogar')!;
    expect(afterRest).toBeLessThan(afterTour);
  });

  it('a rested rider (excluded from the start list) does not appear in the result and scores nothing', () => {
    const season = createSeason(['r-sanreno']);
    const rested = 'gr-philq'; // the player sprinter, benched on the flat day
    const startList = RIDERS.filter((r) => r.id !== rested);
    const res = playEvent(season, 3, startList);
    expect(res.classification.some((row) => row.riderId === rested)).toBe(false);
    expect(season.points.get(rested) ?? 0).toBe(0);
    // …and the field is exactly the start list (minus any abandons)
    expect(res.classification.every((row) => row.riderId !== rested)).toBe(true);
  });
});
