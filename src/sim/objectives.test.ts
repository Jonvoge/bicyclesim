import { describe, expect, it } from 'vitest';

import { OBJECTIVE_WINS_TARGET } from '../data/tuning.ts';
import { objectiveForGeneratedTeam, objectiveForSeason, objectiveStatus } from './objectives.ts';
import { generateWorldDraft } from './worldGeneration.ts';
import { createSeason } from './season.ts';

function seasonWith(results: { raceId: string; winnerId: string }[]) {
  const s = createSeason(['r-sanreno']);
  s.results = results.map((r) => ({ raceId: r.raceId, winnerId: r.winnerId, classification: [] }));
  return s;
}

function classifiedSeason(position: number) {
  const season = createSeason(['r-strada']);
  season.results = [{
    raceId: 'r-strada',
    winnerId: position === 1 ? 'me' : 'rival-1',
    classification: Array.from({ length: 12 }, (_, index) => ({
      riderId: index + 1 === position ? 'me' : `rival-${index + 1}`,
      totalTimeSec: index,
      gapSec: index,
      stagesFinished: 1,
    })),
  }];
  return season;
}

describe('season objectives', () => {
  it('alternates the goal year to year, deterministically', () => {
    expect(objectiveForSeason(1).kind).toBe('monument');
    expect(objectiveForSeason(2).kind).toBe('wins');
    expect(objectiveForSeason(3).kind).toBe('monument');
    expect(objectiveForSeason(2)).toEqual(objectiveForSeason(2));
  });

  it('the Monument goal needs a prestige-90+ win by the player', () => {
    const obj = objectiveForSeason(1); // monument
    const mine = (id: string) => id === 'me';
    // a non-Monument win doesn't count
    const small = seasonWith([{ raceId: 'r-montreol', winnerId: 'me' }]); // prestige 68
    expect(objectiveStatus(obj, small, mine).met).toBe(false);
    // a Monument win does
    const monument = seasonWith([{ raceId: 'r-flandts', winnerId: 'me' }]); // prestige 95
    expect(objectiveStatus(obj, monument, mine).met).toBe(true);
    // a rival's Monument win does not
    expect(objectiveStatus(obj, monument, (id) => id === 'someone-else').met).toBe(false);
  });

  it('the wins goal counts the player’s race wins toward the target', () => {
    const obj = objectiveForSeason(2); // wins
    const mine = (id: string) => id === 'me';
    const results = Array.from({ length: OBJECTIVE_WINS_TARGET }, (_, i) => ({ raceId: 'r-strada', winnerId: i === 0 ? 'rival' : 'me' }));
    const status = objectiveStatus(obj, seasonWith(results), mine);
    expect(status.current).toBe(OBJECTIVE_WINS_TARGET - 1); // one win went to a rival
    expect(status.met).toBe(false);
    // one more player win tips it over
    const more = seasonWith([...results, { raceId: 'r-strada', winnerId: 'me' }]);
    expect(objectiveStatus(obj, more, mine).met).toBe(true);
  });

  it('gives generated teams goals appropriate to division strength', () => {
    const draft = generateWorldDraft({ seed: 700 });
    const proTeams = draft.world.teams.filter((team) => draft.world.teamSeasons[team.id].division === 'pro');
    const goals = proTeams.map((team) => objectiveForGeneratedTeam(draft.world, draft.riders, team.id));
    expect(goals.some((goal) => goal.kind === 'top10s')).toBe(true);
    expect(goals.some((goal) => goal.kind === 'podiums')).toBe(true);
    expect(goals.every((goal) => goal.kind !== 'monument' && goal.kind !== 'wins')).toBe(true);
  });

  it('rotates generated sponsor goals across seasons within each strength band', () => {
    const draft = generateWorldDraft({ seed: 701 });
    for (const team of draft.world.teams) {
      const first = objectiveForGeneratedTeam(draft.world, draft.riders, team.id, 1);
      const second = objectiveForGeneratedTeam(draft.world, draft.riders, team.id, 2);
      const third = objectiveForGeneratedTeam(draft.world, draft.riders, team.id, 3);
      expect(second.kind).not.toBe(first.kind);
      expect(third.kind).toBe(first.kind);
    }
  });

  it('counts one best team result per event for top-10 and podium goals', () => {
    expect(objectiveStatus({ kind: 'top10s', text: '', target: 1, reward: 0 }, classifiedSeason(8), (id) => id === 'me').met).toBe(true);
    expect(objectiveStatus({ kind: 'podiums', text: '', target: 1, reward: 0 }, classifiedSeason(4), (id) => id === 'me').met).toBe(false);
    expect(objectiveStatus({ kind: 'podiums', text: '', target: 1, reward: 0 }, classifiedSeason(2), (id) => id === 'me').met).toBe(true);
  });
});
