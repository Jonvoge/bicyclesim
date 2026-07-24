import { describe, expect, it } from 'vitest';

import { STAGES_BY_ID } from '../data/stages.ts';
import { TEAMS, PLAYER_TEAM } from '../data/teams.ts';
import { MAX_SQUAD_SIZE, MIN_SQUAD_SIZE, SIGNING_FEE_MULT } from '../data/tuning.ts';
import { Rng } from '../sim/rng.ts';
import { buildRaceStory } from '../sim/raceNarrative.ts';
import { defaultTeamTacticsFor } from '../sim/raceSetup.ts';
import { riderRating, salaryFor } from '../sim/rating.ts';
import { startEvent } from '../sim/season.ts';
import { isTourComplete, recordStageResult, ridersForStage } from '../sim/standings.ts';
import {
  createDynasty,
  finishSeasonEvent,
  freeAgents,
  playerBudget,
  playerRiders,
  racingRoster,
  releaseRider,
  rolloverSeason,
  signRider,
  teamRiders,
  trainRider,
  type DynastyState,
} from './dynasty.ts';

/** Play the dynasty's current event to the finish under a seed. */
function playEvent(dynasty: DynastyState, seed: number) {
  const field = racingRoster(dynasty);
  const tour = startEvent(dynasty.season, field);
  const rng = new Rng(seed);
  while (!isTourComplete(tour)) {
    const stage = STAGES_BY_ID.get(tour.stageIds[tour.stageIndex])!;
    const riders = ridersForStage(tour, field);
    const tactics = new Map(TEAMS.map((t) => [t.id, defaultTeamTacticsFor(t.id, teamRiders(dynasty, t.id), stage)]));
    const story = buildRaceStory({ stage, riders, tacticsByTeam: tactics, rng });
    recordStageResult(tour, stage, story.result, tactics, riders);
  }
  return finishSeasonEvent(dynasty, tour);
}

describe('dynasty setup', () => {
  it('clones the roster with contracts on signed riders and a free-agent pool', () => {
    const d = createDynasty();
    expect(playerRiders(d).length).toBe(PLAYER_TEAM.riderIds.length);
    expect(freeAgents(d).length).toBeGreaterThan(0);
    for (const r of playerRiders(d)) {
      expect(r.salary).toBeGreaterThan(0);
      expect(r.contractSeasonsLeft).toBeGreaterThanOrEqual(1);
    }
    for (const r of freeAgents(d)) expect(r.contractSeasonsLeft).toBeUndefined();
    expect(playerBudget(d)).toBeGreaterThan(0);
  });
});

describe('transfers', () => {
  it('signs a free agent: budget drops by the fee, squad grows, rider is contracted', () => {
    const d = createDynasty();
    const fa = freeAgents(d)[0];
    const before = playerBudget(d);
    const fee = Math.round(salaryFor(riderRating(fa)) * SIGNING_FEE_MULT);
    const res = signRider(d, fa.id);
    expect(res.ok).toBe(true);
    expect(playerBudget(d)).toBe(before - fee);
    expect(teamRiders(d, PLAYER_TEAM.id).some((r) => r.id === fa.id)).toBe(true);
    expect(freeAgents(d).some((r) => r.id === fa.id)).toBe(false);
    expect(fa.contractSeasonsLeft).toBeGreaterThan(0);
  });

  it('blocks a signing the team cannot afford', () => {
    const d = createDynasty();
    d.budgets[PLAYER_TEAM.id] = 0;
    expect(signRider(d, freeAgents(d)[0].id).ok).toBe(false);
  });

  it('blocks signing past the squad cap', () => {
    const d = createDynasty();
    d.budgets[PLAYER_TEAM.id] = 1e9;
    let signed = 0;
    for (const fa of [...freeAgents(d)]) if (signRider(d, fa.id).ok) signed++;
    expect(teamRiders(d, PLAYER_TEAM.id).length).toBe(MAX_SQUAD_SIZE);
    expect(signed).toBe(MAX_SQUAD_SIZE - PLAYER_TEAM.riderIds.length);
  });

  it('releasing is blocked at the squad minimum and works above it', () => {
    const d = createDynasty();
    // player starts at MIN_SQUAD_SIZE, so a release is blocked until we sign one
    expect(teamRiders(d, PLAYER_TEAM.id).length).toBe(MIN_SQUAD_SIZE);
    expect(releaseRider(d, playerRiders(d)[0].id).ok).toBe(false);
    d.budgets[PLAYER_TEAM.id] = 1e9;
    signRider(d, freeAgents(d)[0].id);
    const victim = playerRiders(d)[0].id;
    expect(releaseRider(d, victim).ok).toBe(true);
    expect(freeAgents(d).some((r) => r.id === victim)).toBe(true);
  });
});

describe('training', () => {
  it('raises a stat and tires the rider, once per gap', () => {
    const d = createDynasty();
    const r = playerRiders(d)[0];
    const stat = r.stats.climbing;
    const res = trainRider(d, r.id, 'climbing');
    expect(res.ok).toBe(true);
    expect(r.stats.climbing).toBeGreaterThan(stat);
    expect(d.season.fatigue.get(r.id)!).toBeGreaterThan(0);
    // a second session in the same gap is refused
    expect(trainRider(d, r.id, 'climbing').ok).toBe(false);
  });

  it('a new race gap re-opens training', () => {
    const d = createDynasty();
    const r = playerRiders(d)[0];
    trainRider(d, r.id, 'sprint');
    playEvent(d, 1); // finishing an event clears the gap
    expect(trainRider(d, r.id, 'sprint').ok).toBe(true);
  });
});

describe('economy over a season', () => {
  it('an event pays prize money into team budgets', () => {
    const d = createDynasty();
    const before = { ...d.budgets };
    playEvent(d, 4);
    const gained = TEAMS.filter((t) => d.budgets[t.id] > before[t.id]);
    expect(gained.length).toBeGreaterThan(0); // somebody earned prize money
  });

  it('the rollover settles the books and starts a fresh season', () => {
    const d = createDynasty();
    const beforeBudget = playerBudget(d);
    const wages = teamRiders(d, PLAYER_TEAM.id).reduce((s, r) => s + (r.salary ?? 0), 0);
    const summary = rolloverSeason(d); // no events played → no prize, just sponsor − wages
    expect(d.seasonNumber).toBe(2);
    expect(d.season.results.length).toBe(0);
    expect(d.season.eventIndex).toBe(0);
    expect(summary.wages).toBe(wages);
    expect(playerBudget(d)).toBe(Math.round(beforeBudget + summary.sponsor - wages));
    // contracts still valid (auto-renewed if they expired)
    for (const r of playerRiders(d)) expect(r.contractSeasonsLeft).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic under a seed', () => {
    const run = () => {
      const d = createDynasty();
      playEvent(d, 100);
      return playerBudget(d);
    };
    expect(run()).toBe(run());
  });
});
