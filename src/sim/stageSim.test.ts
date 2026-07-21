import { describe, expect, it } from 'vitest';

import { RIDERS, RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { TEAMS, TEAMS_BY_ID } from '../data/teams.ts';
import type { Stage } from '../data/types.ts';
import { Rng } from './rng.ts';
import { baseScore, simulateStage } from './stageSim.ts';
import type { Strategy, TeamTactics } from './tactics.ts';

function stage(id: string): Stage {
  return STAGES_BY_ID.get(id)!;
}

function topBaseScoreRider(s: Stage): string {
  return [...RIDERS].sort((a, b) => baseScore(b, s) - baseScore(a, s))[0].id;
}

/** Rivals protect their best rider and go all-in; player passed explicitly. */
function tacticsMap(s: Stage, player: TeamTactics): Map<string, TeamTactics> {
  const map = new Map<string, TeamTactics>();
  map.set(player.teamId, player);
  for (const team of TEAMS.filter((t) => !t.isPlayer)) {
    const best = team.riderIds
      .map((id) => RIDERS_BY_ID.get(id)!)
      .sort((a, b) => baseScore(b, s) - baseScore(a, s))[0];
    map.set(team.id, { teamId: team.id, protectedRiderId: best.id, strategy: 'ALL_IN_LEADER' });
  }
  return map;
}

function neutralPlayer(s: Stage): TeamTactics {
  return { teamId: 't-grenoble', protectedRiderId: topBaseScoreRider(s), strategy: 'HUNT_STAGE' };
}

describe('baseScore — right stat for the right stage type', () => {
  // The best-suited rider by baseScore should be the right *archetype*: a rider
  // strong in the stat that stage type weights most. We assert the defining stat
  // rather than a hardcoded id so authoring tweaks don't make the test brittle.
  const topStat = (stageId: string, key: keyof (typeof RIDERS)[number]['stats']): number =>
    RIDERS_BY_ID.get(topBaseScoreRider(stage(stageId)))!.stats[key];

  it('a sprint-type wins a flat stage', () => {
    expect(topStat('st-sanreno', 'sprint')).toBeGreaterThanOrEqual(84);
  });
  it('a climber wins a summit finish', () => {
    expect(topStat('st-lombardo', 'climbing')).toBeGreaterThanOrEqual(88);
  });
  it('a time-triallist wins an ITT', () => {
    expect(topStat('st-chrono', 'timeTrial')).toBeGreaterThanOrEqual(90);
  });
  it('a puncheur/cobbled-type wins the cobbled classic', () => {
    expect(topStat('st-roubey', 'puncheur')).toBeGreaterThanOrEqual(82);
  });
});

describe('simulateStage — structural invariants', () => {
  const s = stage('st-lombardo');

  it('is deterministic under a seed', () => {
    const p = neutralPlayer(s);
    const a = simulateStage({ stage: s, riders: RIDERS, tacticsByTeam: tacticsMap(s, p), rng: new Rng(42) });
    const b = simulateStage({ stage: s, riders: RIDERS, tacticsByTeam: tacticsMap(s, p), rng: new Rng(42) });
    expect(a.order.map((e) => e.riderId)).toEqual(b.order.map((e) => e.riderId));
    expect(a.order[0].perfScore).toBeCloseTo(b.order[0].perfScore);
  });

  it('returns every rider once, sorted by perfScore descending', () => {
    const p = neutralPlayer(s);
    const r = simulateStage({ stage: s, riders: RIDERS, tacticsByTeam: tacticsMap(s, p), rng: new Rng(7) });
    expect(r.order).toHaveLength(RIDERS.length);
    expect(new Set(r.order.map((e) => e.riderId)).size).toBe(RIDERS.length);
    for (let i = 1; i < r.order.length; i++) {
      expect(r.order[i - 1].perfScore).toBeGreaterThanOrEqual(r.order[i].perfScore);
      expect(r.order[i].timeSec).toBeGreaterThanOrEqual(r.order[i - 1].timeSec);
    }
  });
});

describe('favourites usually — but not always — win', () => {
  it('the summit favourite wins a majority but loses sometimes', () => {
    const s = stage('st-lombardo');
    const fav = topBaseScoreRider(s);
    let favWins = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const p = neutralPlayer(s);
      const r = simulateStage({ stage: s, riders: RIDERS, tacticsByTeam: tacticsMap(s, p), rng: new Rng(i * 2654435761) });
      if (r.order[0].riderId === fav) favWins++;
    }
    const rate = favWins / N;
    expect(rate).toBeGreaterThan(0.3); // clearly the favourite
    expect(rate).toBeLessThan(0.9); // but giant-killing happens
  });
});

describe('tactics visibly change outcomes', () => {
  it('ALL_IN_LEADER improves the protected rider vs CONSERVE', () => {
    const s = stage('st-lombardo');
    const star = 'gr-pogar';
    const avgPos = (strategy: Strategy): number => {
      const N = 800;
      let sum = 0;
      for (let i = 0; i < N; i++) {
        const p: TeamTactics = { teamId: 't-grenoble', protectedRiderId: star, strategy };
        const r = simulateStage({ stage: s, riders: RIDERS, tacticsByTeam: tacticsMap(s, p), rng: new Rng(i * 40503 + 7) });
        sum += r.order.findIndex((e) => e.riderId === star) + 1;
      }
      return sum / N;
    };
    // Lower average finishing position = better.
    expect(avgPos('ALL_IN_LEADER')).toBeLessThan(avgPos('CONSERVE'));
  });
});

describe('data integrity', () => {
  it('every team roster resolves and player team exists', () => {
    expect(TEAMS.some((t) => t.isPlayer)).toBe(true);
    for (const team of TEAMS) {
      expect(team.riderIds.length).toBeGreaterThan(0);
      for (const id of team.riderIds) expect(TEAMS_BY_ID.get(RIDERS_BY_ID.get(id)!.teamId!)).toBe(team);
    }
  });
});
