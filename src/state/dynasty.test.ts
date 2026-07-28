import { describe, expect, it } from 'vitest';

import { STAGES_BY_ID } from '../data/stages.ts';
import { PRO_CALENDAR, WORLD_CALENDAR } from '../data/races.ts';
import { TEAMS, PLAYER_TEAM } from '../data/teams.ts';
import { MAX_SQUAD_SIZE, MIN_SQUAD_SIZE, RACE_SQUAD_SIZE, SIGNING_FEE_MULT, TARGET_SQUAD_SIZE } from '../data/tuning.ts';
import { Rng } from '../sim/rng.ts';
import { buildRaceStory } from '../sim/raceNarrative.ts';
import { defaultTeamTacticsFor } from '../sim/raceSetup.ts';
import { riderRating, salaryFor } from '../sim/rating.ts';
import { acceptSquadProposal, generateWorldDraft } from '../sim/worldGeneration.ts';
import { currentRace, startEvent } from '../sim/season.ts';
import { isTourComplete, recordStageResult, ridersForStage } from '../sim/standings.ts';
import {
  campEventIndices,
  createDynasty,
  createGeneratedDynasty,
  dynastyTeams,
  finishSeasonEvent,
  freeAgents,
  pickRaceSquad,
  playerBudget,
  playerRiders,
  racingRoster,
  releaseRider,
  rolloverSeason,
  signRider,
  startSeasonEvent,
  teamRiders,
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
    expect(playerRiders(d).length).toBe(TARGET_SQUAD_SIZE); // padded to a rotatable depth
    expect(freeAgents(d).length).toBeGreaterThan(0);
    for (const r of playerRiders(d)) {
      expect(r.salary).toBeGreaterThan(0);
      expect(r.contractSeasonsLeft).toBeGreaterThanOrEqual(1);
    }
    for (const r of freeAgents(d)) expect(r.contractSeasonsLeft).toBeUndefined();
    expect(playerBudget(d)).toBeGreaterThan(0);
  });

  it('creates a generated dynasty from an accepted founding squad', () => {
    const draft = generateWorldDraft({ seed: 2028 });
    const accepted = acceptSquadProposal(draft, draft.proposals[0].id);
    const dynasty = createGeneratedDynasty(accepted);

    expect(dynasty.world?.seed).toBe(2028);
    expect(dynastyTeams(dynasty)).toHaveLength(22);
    expect(playerRiders(dynasty)).toHaveLength(8);
    expect(racingRoster(dynasty)).toHaveLength(22 * 8);
    expect(playerBudget(dynasty)).toBe(dynasty.world?.teamSeasons[dynasty.playerTeamId].budget);
    expect(dynasty.budgets).toEqual({});
    expect(dynasty.world?.teamSeasons[dynasty.playerTeamId].division).toBe('pro');
    expect(dynasty.season.calendar).toEqual(PRO_CALENDAR);
    expect(dynasty.world?.eventFields).toHaveLength(30);
  });

  it('uses the stored generated-world field and moves divisions at rollover', () => {
    const draft = generateWorldDraft({ seed: 2029 });
    const dynasty = createGeneratedDynasty(acceptSquadProposal(draft, draft.proposals[0].id));
    const race = currentRace(dynasty.season)!;
    const field = dynasty.world!.eventFields.find((entry) => entry.season === 1 && entry.raceId === race.id)!;
    const tour = startSeasonEvent(dynasty, race);
    expect(tour.starters).toHaveLength(field.teamIds.length * RACE_SQUAD_SIZE);
    expect(new Set([...tour.starters!].map((riderId) => dynasty.roster.find((rider) => rider.id === riderId)!.teamId))).toEqual(
      new Set(field.teamIds),
    );

    rolloverSeason(dynasty);
    expect(dynasty.world!.history.raceWinners).toHaveLength(30);
    expect(dynasty.world!.history.promotions).toHaveLength(1);
    expect(dynasty.world!.history.teamChampions).toHaveLength(2);
    const division = dynasty.world!.teamSeasons[dynasty.playerTeamId].division;
    expect(dynasty.season.calendar).toEqual(division === 'world' ? WORLD_CALENDAR : PRO_CALENDAR);
  });

  it('tapers and protects a Rival Director target leader', () => {
    const draft = generateWorldDraft({ seed: 2030 });
    const dynasty = createGeneratedDynasty(acceptSquadProposal(draft, draft.proposals[0].id));
    const plan = dynasty.world!.directorPlans.find((entry) =>
      entry.teamId !== dynasty.playerTeamId
      && dynasty.world!.teamSeasons[entry.teamId].division === 'pro'
      && entry.targets.some((target) => PRO_CALENDAR.indexOf(target.raceId) > 0),
    )!;
    const target = plan.targets.find((entry) => PRO_CALENDAR.indexOf(entry.raceId) > 0)!;
    const targetIndex = PRO_CALENDAR.indexOf(target.raceId);

    dynasty.season.eventIndex = targetIndex - 1;
    const taperTour = startSeasonEvent(dynasty, currentRace(dynasty.season)!);
    expect(taperTour.starters?.has(target.leaderId)).toBe(false);

    dynasty.season.eventIndex = targetIndex;
    const targetTour = startSeasonEvent(dynasty, currentRace(dynasty.season)!);
    expect(targetTour.starters?.has(target.leaderId)).toBe(true);
  });

  it('keeps every generated team above the legal roster minimum', () => {
    const draft = generateWorldDraft({ seed: 2031 });
    const dynasty = createGeneratedDynasty(acceptSquadProposal(draft, draft.proposals[0].id));
    for (let season = 0; season < 10; season++) rolloverSeason(dynasty);
    expect(dynastyTeams(dynasty).every((team) => teamRiders(dynasty, team.id).length >= MIN_SQUAD_SIZE)).toBe(true);
  });
});

describe('transfers', () => {
  it('signs a free agent: budget drops by the fee, squad grows, rider is contracted', () => {
    const d = createDynasty();
    d.budgets[PLAYER_TEAM.id] = 5000; // enough to afford the fee under the tightened economy
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
    expect(signed).toBe(MAX_SQUAD_SIZE - TARGET_SQUAD_SIZE); // starts padded to TARGET
  });

  it('releasing is blocked at the squad minimum and works above it', () => {
    const d = createDynasty();
    // player starts padded above the minimum, so releases are allowed down to it
    expect(teamRiders(d, PLAYER_TEAM.id).length).toBe(TARGET_SQUAD_SIZE);
    while (teamRiders(d, PLAYER_TEAM.id).length > MIN_SQUAD_SIZE) {
      expect(releaseRider(d, playerRiders(d)[0].id).ok).toBe(true);
    }
    // at the minimum, further releases are blocked
    expect(teamRiders(d, PLAYER_TEAM.id).length).toBe(MIN_SQUAD_SIZE);
    expect(releaseRider(d, playerRiders(d)[0].id).ok).toBe(false);
    d.budgets[PLAYER_TEAM.id] = 1e9;
    signRider(d, freeAgents(d)[0].id);
    const victim = playerRiders(d)[0].id;
    expect(releaseRider(d, victim).ok).toBe(true);
    expect(freeAgents(d).some((r) => r.id === victim)).toBe(true);
  });
});

describe('auto-training camps', () => {
  it('spaces the camps evenly through the season (never the opener/closer)', () => {
    expect(campEventIndices(14)).toEqual([3, 6, 8, 11]);
    for (const i of campEventIndices(14)) {
      expect(i).toBeGreaterThan(0);
      expect(i).toBeLessThan(14);
    }
  });

  it('fires only at the milestone events and develops the player squad', () => {
    const d = createDynasty();
    const camps = campEventIndices(d.season.calendar.length);
    let sawCamp = false;
    for (let e = 0; e < d.season.calendar.length; e++) {
      const atMilestone = camps.includes(e + 1); // eventIndex after this event
      playEvent(d, 10 + e);
      if (atMilestone) {
        expect(d.lastTraining).not.toBeNull();
        expect(d.lastTraining!.afterEvent).toBe(e + 1);
        expect(d.lastTraining!.improvedCount).toBeGreaterThan(0);
        expect(d.lastTraining!.totalGain).toBeGreaterThan(0); // riders actually got stronger
        sawCamp = true;
      } else {
        expect(d.lastTraining).toBeNull();
      }
    }
    expect(sawCamp).toBe(true);
  });
});

describe('economy over a season', () => {
  it('an event pays prize money into team budgets', () => {
    const d = createDynasty();
    const before = { ...d.budgets };
    playEvent(d, 4);
    const gained = TEAMS.filter((t) => d.budgets[t.id] > before[t.id]);
    expect(gained.length).toBeGreaterThan(0); // somebody earned prize money
    expect(d.lastSettlement).not.toBeNull();
    expect(d.lastSettlement!.result.raceId).toBe(d.season.results[0].raceId);
    expect(d.lastSettlement!.budgetBalance).toBe(playerBudget(d));
    expect(d.lastSettlement!.fatigue).toHaveLength(playerRiders(d).length);
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

describe('pick-5 race squads (Phase 8)', () => {
  it('startSeasonEvent fields exactly RACE_SQUAD_SIZE riders per team', () => {
    const d = createDynasty();
    const tour = startSeasonEvent(d, currentRace(d.season)!);
    for (const t of TEAMS) {
      const started = teamRiders(d, t.id).filter((r) => tour.starters!.has(r.id)).length;
      expect(started).toBe(RACE_SQUAD_SIZE);
    }
    expect(tour.starters!.size).toBe(TEAMS.length * RACE_SQUAD_SIZE);
  });

  it('a heavily-fatigued rider is dropped for a fresher teammate', () => {
    const d = createDynasty();
    const stage = STAGES_BY_ID.get('st-lombardo')!;
    const roster = teamRiders(d, PLAYER_TEAM.id);
    const fresh = pickRaceSquad(roster, stage, new Map(), false);
    expect(fresh.length).toBe(RACE_SQUAD_SIZE);
    const cooked = pickRaceSquad(roster, stage, new Map([[fresh[0], 10]]), false);
    expect(cooked).not.toContain(fresh[0]);
  });
});

describe('development across the rollover (Phase 6)', () => {
  it('keeps a retired player rider name in the rollover summary', () => {
    const d = createDynasty();
    const rider = playerRiders(d)[0];
    rider.age = 100;
    const summary = rolloverSeason(d);

    expect(summary.retired).toContainEqual({ id: rider.id, name: rider.name });
    expect(d.roster.some((entry) => entry.id === rider.id)).toBe(false);
  });

  it('seeds hidden potential and ages the peloton at the rollover', () => {
    const d = createDynasty();
    for (const r of d.roster) {
      expect(r.peakAge).toBeDefined();
      expect(r.ceiling).toBeDefined();
    }
    const before = new Map(d.roster.map((r) => [r.id, r.age]));
    rolloverSeason(d);
    // every rider carried over is exactly one year older
    for (const r of d.roster) {
      const wasAge = before.get(r.id);
      if (wasAge !== undefined) expect(r.age).toBe(wasAge + 1);
    }
  });

  it('retires some veterans and brings in fresh young free agents', () => {
    const d = createDynasty();
    const beforeIds = new Set(d.roster.map((r) => r.id));
    // run several rollovers so ageing pushes riders into the retirement zone
    let sawRetirement = false;
    let sawNewBlood = false;
    for (let s = 0; s < 6; s++) {
      const summary = rolloverSeason(d);
      if (summary.retiredAll > 0) sawRetirement = true;
      if (d.roster.some((r) => r.id.startsWith('fa-gen-'))) sawNewBlood = true;
    }
    expect(sawRetirement).toBe(true);
    expect(sawNewBlood).toBe(true);
    // some of the original riders are gone (retired)
    expect(d.roster.some((r) => !beforeIds.has(r.id))).toBe(true);
    // every team can still field a race (auto-fill held the minimum)
    for (const t of TEAMS) expect(teamRiders(d, t.id).length).toBeGreaterThanOrEqual(MIN_SQUAD_SIZE);
  });

  it('keeps the roster bounded over a long dynasty', () => {
    const d = createDynasty();
    const start = d.roster.length;
    for (let s = 0; s < 12; s++) rolloverSeason(d);
    // pool cull + retirements keep it from ballooning despite 7 new riders/season
    expect(d.roster.length).toBeLessThan(start + 30);
    expect(new Set(d.roster.map((rider) => rider.name)).size).toBe(d.roster.length);
  });

  it('rollover is deterministic', () => {
    const run = () => {
      const d = createDynasty();
      for (let s = 0; s < 4; s++) rolloverSeason(d);
      return d.roster.map((r) => `${r.id}:${r.age}`).sort().join(',');
    };
    expect(run()).toBe(run());
  });
});
