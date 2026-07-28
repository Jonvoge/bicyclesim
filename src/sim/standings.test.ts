import { describe, expect, it } from 'vitest';

import { RIDERS } from '../data/riders.ts';
import { TEAMS } from '../data/teams.ts';
import { STAGE_RECOVERY_RATE } from '../data/tuning.ts';
import type { Race, Stage } from '../data/types.ts';
import { Rng } from './rng.ts';
import { buildRaceStory } from './raceNarrative.ts';
import { defaultTeamTactics } from './raceSetup.ts';
import {
  computeGc,
  createTour,
  fatigueGain,
  isTourComplete,
  recordStageResult,
  ridersForStage,
  stageDifficulty,
} from './standings.ts';
import { roleCounts, tacticsEffect, type TeamTactics } from './tactics.ts';

const STAGES: Stage[] = [
  { id: 's1', name: 'Stage 1', type: 'flat', lengthKm: 190 },
  { id: 's2', name: 'Stage 2', type: 'hilly', lengthKm: 200 },
  { id: 's3', name: 'Stage 3', type: 'summitFinish', lengthKm: 210 },
];
const STAGES_BY_ID = new Map(STAGES.map((s) => [s.id, s]));
const RACE: Race = { id: 'tour', name: 'Test Tour', type: 'shortTour', stageIds: ['s1', 's2', 's3'], prestige: 100 };

function tacticsFor(stage: Stage): Map<string, TeamTactics> {
  const map = new Map<string, TeamTactics>();
  for (const team of TEAMS) map.set(team.id, defaultTeamTactics(team, stage));
  return map;
}

/** Run a whole tour headlessly under a seed; return the finished tour. */
function runTour(seed: number, effortByTeam?: (teamId: string) => 'race' | 'conserve') {
  const tour = createTour(RACE);
  const rng = new Rng(seed);
  while (!isTourComplete(tour)) {
    const stage = STAGES_BY_ID.get(tour.stageIds[tour.stageIndex])!;
    const riders = ridersForStage(tour, RIDERS);
    const tactics = tacticsFor(stage);
    if (effortByTeam) for (const [id, t] of tactics) tactics.set(id, { ...t, effort: effortByTeam(id) });
    const story = buildRaceStory({ stage, riders, tacticsByTeam: tactics, rng });
    recordStageResult(tour, stage, story.result, tactics, riders);
  }
  return tour;
}

describe('GC (general classification)', () => {
  it('is cumulative stage time, sorted lowest-first with gaps off the leader', () => {
    const tour = runTour(42);
    const gc = computeGc(tour);
    expect(gc.length).toBeGreaterThan(0);
    for (let i = 1; i < gc.length; i++) {
      expect(gc[i].totalTimeSec).toBeGreaterThanOrEqual(gc[i - 1].totalTimeSec);
    }
    expect(gc[0].gapSec).toBe(0);
    expect(gc[1].gapSec).toBeCloseTo(gc[1].totalTimeSec - gc[0].totalTimeSec, 5);
    // the leader's total equals the sum of their per-stage times
    const leaderId = gc[0].riderId;
    const summed = tour.results.reduce((acc, r) => acc + r.order.find((e) => e.riderId === leaderId)!.timeSec, 0);
    expect(gc[0].totalTimeSec).toBeCloseTo(summed, 5);
  });

  it('every finisher of every stage holds a GC place', () => {
    const tour = runTour(7);
    const gc = computeGc(tour);
    const everFinishedAll = RIDERS.filter((r) => !tour.abandoned.has(r.id));
    // all non-abandoned riders who finished every stage appear exactly once
    expect(new Set(gc.map((g) => g.riderId)).size).toBe(gc.length);
    expect(gc.length).toBeLessThanOrEqual(everFinishedAll.length);
    for (const g of gc) expect(g.stagesFinished).toBe(tour.results.length);
  });

  it('is deterministic under a seed', () => {
    const a = computeGc(runTour(123));
    const b = computeGc(runTour(123));
    expect(a.map((g) => g.riderId)).toEqual(b.map((g) => g.riderId));
    expect(a.map((g) => g.totalTimeSec)).toEqual(b.map((g) => g.totalTimeSec));
  });

  it('an abandoned rider is dropped from GC and from later stages', () => {
    // force an abandon on stage 1 by hand, then check they never reappear
    const tour = createTour(RACE);
    const stage = STAGES[0];
    const riders = ridersForStage(tour, RIDERS);
    const tactics = tacticsFor(stage);
    const story = buildRaceStory({ stage, riders, tacticsByTeam: tactics, rng: new Rng(1) });
    const victim = story.result.order.find((e) => !e.dnf)!.riderId;
    story.result.order.find((e) => e.riderId === victim)!.dnf = true;
    recordStageResult(tour, stage, story.result, tactics, riders);
    expect(tour.abandoned.has(victim)).toBe(true);
    expect(ridersForStage(tour, RIDERS).some((r) => r.id === victim)).toBe(false);
    expect(computeGc(tour).some((g) => g.riderId === victim)).toBe(false);
  });
});

describe('fatigue across stages (SPEC §5.8)', () => {
  it('accrues over a tour, so a rider is carrying fatigue by the final stage', () => {
    const tour = createTour(RACE);
    const rng = new Rng(99);
    let fatigueBeforeLast = 0;
    while (!isTourComplete(tour)) {
      const stage = STAGES_BY_ID.get(tour.stageIds[tour.stageIndex])!;
      if (tour.stageIndex === tour.stageIds.length - 1) fatigueBeforeLast = tour.fatigue.get('gr-pogar') ?? 0;
      const riders = ridersForStage(tour, RIDERS);
      const tactics = tacticsFor(stage);
      const story = buildRaceStory({ stage, riders, tacticsByTeam: tactics, rng });
      recordStageResult(tour, stage, story.result, tactics, riders);
    }
    expect(fatigueBeforeLast).toBeGreaterThan(0);
  });

  it('a higher-stamina rider banks less fatigue than a lower-stamina one on the same day', () => {
    const stage = STAGES[2];
    const hi = RIDERS.find((r) => r.id === 'vm-vinge')!; // stamina 88
    const lo = RIDERS.find((r) => r.id === 'gr-vance')!; // stamina 72
    expect(hi.stats.stamina).toBeGreaterThan(lo.stats.stamina);
    expect(fatigueGain(hi, stage, 1)).toBeLessThan(fatigueGain(lo, stage, 1));
  });

  it('harder + longer stages are worth more fatigue', () => {
    expect(stageDifficulty(STAGES[2])).toBeGreaterThan(stageDifficulty(STAGES[0]));
  });
});

describe('conserve effort lever (SPEC §5.8)', () => {
  it('penalizes every role and lowers every rider fatigue gain', () => {
    const stage = STAGES[2];
    const counts = roleCounts({ teamId: 't', roles: { l: 'leader', s: 'sprinter', d: 'domestique', f: 'free' } });
    for (const role of ['leader', 'sprinter', 'domestique', 'free'] as const) {
      const racing = tacticsEffect(role, counts, stage.type, 'race');
      const conserving = tacticsEffect(role, counts, stage.type, 'conserve');
      expect(conserving.fatigueMult).toBeLessThan(racing.fatigueMult);
      expect(conserving.perfMod).toBeLessThan(racing.perfMod);
    }
  });

  it('over a tour, a team that conserves early carries less fatigue into the finish', () => {
    const raced = runTour(555, () => 'race');
    const conserved = runTour(555, (id) => (id === 't-grenoble' ? 'conserve' : 'race'));
    const star = 'gr-pogar';
    const racedF = sumTeamFatigueSeen(raced);
    const conservedF = sumTeamFatigueSeen(conserved);
    // the conserving team's leader ends the tour fresher
    expect(conserved.fatigue.get(star) ?? 0).toBeLessThan(raced.fatigue.get(star) ?? Infinity);
    expect(conservedF).toBeLessThan(racedF * 0.71);
  });

  it('reports fatigue gained, saved, and carried into the next stage', () => {
    const stage = STAGES[0];
    const tour = createTour(RACE);
    const riders = ridersForStage(tour, RIDERS);
    const tactics = new Map(
      TEAMS.map((team) => {
        const sheet = defaultTeamTactics(team, stage);
        return [team.id, { ...sheet, effort: team.id === 't-grenoble' ? ('conserve' as const) : ('race' as const) }];
      }),
    );
    const story = buildRaceStory({ stage, riders, tacticsByTeam: tactics, rng: new Rng(88) });
    const summary = recordStageResult(tour, stage, story.result, tactics, riders);
    const conserved = summary.find((row) => RIDERS.find((rider) => rider.id === row.riderId)?.teamId === 't-grenoble')!;
    const racing = summary.find((row) => RIDERS.find((rider) => rider.id === row.riderId)?.teamId !== 't-grenoble')!;
    expect(conserved.gained).toBeGreaterThan(0);
    expect(conserved.savedVsRace).toBeGreaterThan(0);
    expect(conserved.nextStage).toBeCloseTo((conserved.incoming + conserved.gained) * STAGE_RECOVERY_RATE);
    expect(racing.savedVsRace).toBe(0);
  });
});

function sumTeamFatigueSeen(tour: ReturnType<typeof runTour>): number {
  let sum = 0;
  for (const r of RIDERS) if (r.teamId === 't-grenoble') sum += tour.fatigue.get(r.id) ?? 0;
  return sum;
}
