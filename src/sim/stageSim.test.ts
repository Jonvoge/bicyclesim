import { describe, expect, it } from 'vitest';

import { RIDERS, RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { TEAMS, TEAMS_BY_ID } from '../data/teams.ts';
import type { Stage } from '../data/types.ts';
import { Rng } from './rng.ts';
import { baseScore, simulateStage } from './stageSim.ts';
import { buildRaceStory, interpGap } from './raceNarrative.ts';
import { bestSuitedRider } from './raceSetup.ts';
import type { Strategy, TeamTactics } from './tactics.ts';

function stage(id: string): Stage {
  return STAGES_BY_ID.get(id)!;
}

function topBaseScoreRider(s: Stage): string {
  return [...RIDERS].sort((a, b) => baseScore(b, s) - baseScore(a, s))[0].id;
}

/** Every team (incl. player) protects its best rider, PROTECT_LEADER. */
function allProtectLeader(s: Stage): Map<string, TeamTactics> {
  const map = new Map<string, TeamTactics>();
  for (const team of TEAMS) {
    map.set(team.id, { teamId: team.id, protectedRiderId: bestSuitedRider(team.riderIds, s), strategy: 'PROTECT_LEADER' });
  }
  return map;
}

/** Rivals protect their best; player tactics passed explicitly. */
function withPlayer(s: Stage, player: TeamTactics): Map<string, TeamTactics> {
  const map = allProtectLeader(s);
  map.set(player.teamId, player);
  return map;
}

describe('baseScore — right stat for the right stage type', () => {
  const topStat = (stageId: string, key: keyof (typeof RIDERS)[number]['stats']): number =>
    RIDERS_BY_ID.get(topBaseScoreRider(stage(stageId)))!.stats[key];

  it('a sprint-type wins a flat stage', () => {
    expect(topStat('st-sanreno', 'sprint')).toBeGreaterThanOrEqual(84);
  });
  it('a climber wins a summit finish', () => {
    expect(topStat('st-lombardo', 'climbing')).toBeGreaterThanOrEqual(88);
  });
  it('a puncheur wins the hilly classic', () => {
    expect(topStat('st-fleche', 'puncheur')).toBeGreaterThanOrEqual(84);
  });
  it('a puncheur/cobbled-type wins the cobbled classic', () => {
    expect(topStat('st-roubey', 'puncheur')).toBeGreaterThanOrEqual(82);
  });
});

describe('simulateStage — structural invariants', () => {
  const s = stage('st-lombardo');

  it('is deterministic under a seed', () => {
    const t = allProtectLeader(s);
    const a = simulateStage({ stage: s, riders: RIDERS, tacticsByTeam: t, rng: new Rng(42) });
    const b = simulateStage({ stage: s, riders: RIDERS, tacticsByTeam: t, rng: new Rng(42) });
    expect(a.order.map((e) => e.riderId)).toEqual(b.order.map((e) => e.riderId));
  });

  it('returns every rider once, sorted best-first (perf desc, time asc)', () => {
    const r = simulateStage({ stage: s, riders: RIDERS, tacticsByTeam: allProtectLeader(s), rng: new Rng(7) });
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
      const r = simulateStage({ stage: s, riders: RIDERS, tacticsByTeam: allProtectLeader(s), rng: new Rng(i * 2654435761) });
      if (r.order[0].riderId === fav) favWins++;
    }
    const rate = favWins / N;
    expect(rate).toBeGreaterThan(0.3);
    expect(rate).toBeLessThan(0.92);
  });
});

describe('tactics visibly change outcomes', () => {
  it('PROTECT_LEADER improves the protected rider vs CONSERVE', () => {
    const s = stage('st-lombardo');
    const star = 'gr-pogar';
    const avgPos = (strategy: Strategy): number => {
      const N = 800;
      let sum = 0;
      for (let i = 0; i < N; i++) {
        const p: TeamTactics = { teamId: 't-grenoble', protectedRiderId: star, strategy };
        const r = simulateStage({ stage: s, riders: RIDERS, tacticsByTeam: withPlayer(s, p), rng: new Rng(i * 40503 + 7) });
        sum += r.order.findIndex((e) => e.riderId === star) + 1;
      }
      return sum / N;
    };
    expect(avgPos('PROTECT_LEADER')).toBeLessThan(avgPos('CONSERVE'));
  });
});

describe('race narrative layer (SPEC §5.9)', () => {
  const s = stage('st-lombardo');

  it('is deterministic under a seed (result, groups, and radio events)', () => {
    const t = allProtectLeader(s);
    const a = buildRaceStory({ stage: s, riders: RIDERS, tacticsByTeam: t, rng: new Rng(99) });
    const b = buildRaceStory({ stage: s, riders: RIDERS, tacticsByTeam: t, rng: new Rng(99) });
    expect(a.result.order.map((e) => e.riderId)).toEqual(b.result.order.map((e) => e.riderId));
    expect(a.breakSurvived).toBe(b.breakSurvived);
    expect(JSON.stringify(a.groups)).toBe(JSON.stringify(b.groups));
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });

  it('gives every rider a story that ends at their final gap, with a leader at all times', () => {
    const story = buildRaceStory({ stage: s, riders: RIDERS, tacticsByTeam: allProtectLeader(s), rng: new Rng(3) });
    expect(story.stories.size).toBe(RIDERS.length);
    const winnerTime = story.result.order[0].timeSec;
    for (const entry of story.result.order) {
      if (entry.dnf) continue;
      const st = story.stories.get(entry.riderId)!;
      expect(interpGap(st.gaps, 1)).toBeCloseTo(entry.timeSec - winnerTime, 1);
    }
    // there is always a lead group near the head of the race (the scene renders
    // everyone relative to the front, so this need only be tight, not exactly 0)
    for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const minGap = Math.min(...[...story.stories.values()].map((st) => interpGap(st.gaps, t)));
      expect(minGap).toBeLessThan(12);
    }
  });

  it('finishers arrive in groups; whole group shares a time (SPEC §5.7)', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const story = buildRaceStory({ stage: s, riders: RIDERS, tacticsByTeam: allProtectLeader(s), rng: new Rng(seed) });
      const nonDnf = story.result.order.filter((e) => !e.dnf);
      // groups partition the finishers
      expect(story.groups.flatMap((g) => g.ids).sort()).toEqual(nonDnf.map((e) => e.riderId).sort());
      for (const g of story.groups) {
        for (const id of g.ids) {
          expect(story.result.order.find((e) => e.riderId === id)!.timeSec).toBe(g.timeSec);
        }
      }
      // group times strictly increase
      for (let i = 1; i < story.groups.length; i++) {
        expect(story.groups[i].timeSec).toBeGreaterThan(story.groups[i - 1].timeSec);
      }
    }
  });

  it('narrates the race: break composition on the radio', () => {
    const story = buildRaceStory({ stage: s, riders: RIDERS, tacticsByTeam: allProtectLeader(s), rng: new Rng(5) });
    if (story.breakIds.length > 0) {
      const breakEvent = story.events.find((e) => e.kind === 'break');
      expect(breakEvent).toBeDefined();
      for (const id of story.breakIds) {
        const last = RIDERS_BY_ID.get(id)!.name.split(' ').slice(-1)[0];
        expect(breakEvent!.text).toContain(last);
      }
    }
    // a decisive late-race moment always lands (break holds / attack / finale)
    expect(story.events.some((e) => e.t >= 0.7)).toBe(true);
  });

  const survivalRate = (stageId: string, strategy: Strategy, protectedId: string, n = 1000): number => {
    const s2 = stage(stageId);
    let survived = 0;
    for (let i = 0; i < n; i++) {
      const p: TeamTactics = { teamId: 't-grenoble', protectedRiderId: protectedId, strategy };
      const story = buildRaceStory({ stage: s2, riders: RIDERS, tacticsByTeam: withPlayer(s2, p), rng: new Rng(i * 2246822519) });
      if (story.breakSurvived) survived++;
    }
    return survived / n;
  };

  // gr-vance is a clear non-favourite → committing him puts him in the morning break
  it('committing a domestique to the break raises its survival odds (but stays bounded)', () => {
    const withBreak = survivalRate('st-roubey', 'BREAKAWAY', 'gr-vance');
    const without = survivalRate('st-roubey', 'PROTECT_LEADER', 'gr-vance');
    expect(without).toBeLessThan(0.3);
    expect(withBreak).toBeGreaterThan(without + 0.06);
    expect(withBreak).toBeLessThan(0.6);
  });

  it('terrain matters: breaks survive more often on a hilly day than a flat one', () => {
    const hilly = survivalRate('st-fleche', 'BREAKAWAY', 'gr-vance', 600);
    const flat = survivalRate('st-sanreno', 'BREAKAWAY', 'gr-vance', 600);
    expect(hilly).toBeGreaterThan(flat + 0.05);
  });

  it('the morning break is opportunists — the strongest climber is almost never in it on a summit', () => {
    const s2 = stage('st-lombardo');
    let inBreak = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const story = buildRaceStory({ stage: s2, riders: RIDERS, tacticsByTeam: allProtectLeader(s2), rng: new Rng(i * 40503 + 11) });
      if (story.breakIds.includes('vm-vinge')) inBreak++;
    }
    expect(inBreak / N).toBeLessThan(0.05);
  });

  it('punctures never cause an abandon; crashes rarely do', () => {
    let punctureDnf = 0;
    let crashes = 0;
    let crashDnf = 0;
    const s2 = stage('st-roubey');
    for (let i = 0; i < 2500; i++) {
      const story = buildRaceStory({ stage: s2, riders: RIDERS, tacticsByTeam: allProtectLeader(s2), rng: new Rng(i * 7919 + 1) });
      for (const st of story.stories.values()) {
        if (!st.incident) continue;
        if (st.incident.type === 'puncture') {
          if (st.incident.dnf) punctureDnf++;
        } else {
          crashes++;
          if (st.incident.dnf) crashDnf++;
        }
      }
    }
    expect(punctureDnf).toBe(0); // punctures never abandon
    expect(crashes).toBeGreaterThan(0);
    expect(crashDnf / crashes).toBeLessThan(0.15); // crash abandons are rare
  });

  it('produces varied race shapes across seeds, and attackers are never in the morning break', () => {
    const shapes = new Set<string>();
    for (const stg of ['st-lombardo', 'st-fleche', 'st-roubey', 'st-sanreno']) {
      const s2 = stage(stg);
      for (let i = 0; i < 250; i++) {
        const story = buildRaceStory({ stage: s2, riders: RIDERS, tacticsByTeam: allProtectLeader(s2), rng: new Rng(i * 2654435761 + stg.length) });
        shapes.add(story.shape);
        if (story.attackerId) expect(story.breakIds).not.toContain(story.attackerId);
      }
    }
    expect(shapes.size).toBeGreaterThanOrEqual(3); // not formulaic
    expect(shapes.has('soloAttack')).toBe(true); // favourites do attack late
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
