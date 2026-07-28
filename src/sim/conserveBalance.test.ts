import { describe, expect, it } from 'vitest';

import { RACES_BY_ID } from '../data/races.ts';
import { RIDERS, RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { TEAMS } from '../data/teams.ts';
import { buildRaceStory } from './raceNarrative.ts';
import { defaultTeamTactics } from './raceSetup.ts';
import { Rng } from './rng.ts';
import { computeGc, createTour, isTourComplete, recordStageResult, ridersForStage } from './standings.ts';
import type { TeamEffort, TeamTactics } from './tactics.ts';

function tourWins(raceId: string, starId: string, conserveStages: Set<number>, runs: number): number {
  const race = RACES_BY_ID.get(raceId)!;
  const teamId = RIDERS_BY_ID.get(starId)!.teamId!;
  let wins = 0;
  for (let seed = 0; seed < runs; seed++) {
    const tour = createTour(race);
    const rng = new Rng(seed * 2654435761 + 31);
    while (!isTourComplete(tour)) {
      const stageIndex = tour.stageIndex;
      const stage = STAGES_BY_ID.get(tour.stageIds[stageIndex])!;
      const riders = ridersForStage(tour, RIDERS);
      const tactics = new Map<string, TeamTactics>();
      for (const team of TEAMS) {
        const effort: TeamEffort = team.id === teamId && conserveStages.has(stageIndex) ? 'conserve' : 'race';
        tactics.set(team.id, { ...defaultTeamTactics(team, stage), effort });
      }
      const story = buildRaceStory({ stage, riders, tacticsByTeam: tactics, rng });
      recordStageResult(tour, stage, story.result, tactics, riders);
    }
    if (computeGc(tour)[0]?.riderId === starId) wins++;
  }
  return wins;
}

describe('matched-seed Conserve strategy balance', () => {
  for (const raceId of ['r-provence', 'r-aurelia', 'r-iberia']) {
    it(`${raceId}: selective use beats Race-all, while Conserve-all is worse`, () => {
      const race = RACES_BY_ID.get(raceId)!;
      const selective = new Set(
        race.stageIds
          .map((stageId, index) => ({ stage: STAGES_BY_ID.get(stageId)!, index }))
          .filter(({ stage }) => stage.type === 'flat' || stage.type === 'cobbled' || stage.type === 'descentFinish')
          .map(({ index }) => index),
      );
      const all = new Set(race.stageIds.map((_, index) => index));
      const runs = 100;
      let raceWins = 0;
      let selectiveWins = 0;
      let allWins = 0;
      for (const starId of ['gr-pogar', 'vm-vinge']) {
        raceWins += tourWins(raceId, starId, new Set(), runs);
        selectiveWins += tourWins(raceId, starId, selective, runs);
        allWins += tourWins(raceId, starId, all, runs);
      }
      expect(selectiveWins).toBeGreaterThan(raceWins);
      expect(allWins).toBeLessThan(selectiveWins);
      expect(allWins).toBeLessThan(raceWins * 1.8);
    });
  }
});