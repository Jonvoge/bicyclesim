import { describe, expect, it } from 'vitest';

import { OBJECTIVE_WINS_TARGET } from '../data/tuning.ts';
import { objectiveForSeason, objectiveStatus } from './objectives.ts';
import { createSeason } from './season.ts';

function seasonWith(results: { raceId: string; winnerId: string }[]) {
  const s = createSeason(['r-sanreno']);
  s.results = results.map((r) => ({ raceId: r.raceId, winnerId: r.winnerId, classification: [] }));
  return s;
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
});
