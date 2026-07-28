import { describe, expect, it } from 'vitest';
import { RACES_BY_ID } from '../data/races.ts';
import { WILDCARD_MIN_REPUTATION } from '../data/tuning.ts';
import { generateWorldDraft } from './worldGeneration.ts';
import {
  applyDivisionMovement,
  divisionStatus,
  rankDivision,
  resetDivisionCompetition,
  selectEventField,
  simulateBackgroundCompetition,
} from './competition.ts';

describe('division competition', () => {
  it('ranks points, then wins, then prestigious result with a deterministic final tie', () => {
    const world = generateWorldDraft({ seed: 77 }).world;
    const teams = world.teams.filter((team) => world.teamSeasons[team.id].division === 'pro');
    teams.forEach((team) => Object.assign(world.teamSeasons[team.id], { rankingPoints: 100, wins: 1, bestPrestigeResult: 50 }));
    world.teamSeasons[teams[0].id].rankingPoints = 101;
    world.teamSeasons[teams[1].id].wins = 2;
    world.teamSeasons[teams[2].id].bestPrestigeResult = 60;

    const first = rankDivision(world, 'pro', 1);
    expect(first.slice(0, 3).map((row) => row.teamId)).toEqual([teams[0].id, teams[1].id, teams[2].id]);
    expect(rankDivision(world, 'pro', 1)).toEqual(first);
    const status = divisionStatus(world, teams[3].id, 1);
    expect(status.division).toBe('pro');
    expect(status.lineRank).toBe(2);
    expect(status.pointsToLine).toBeGreaterThanOrEqual(0);
  });

  it('selects only eligible teams and stores deterministic wildcard reasons', () => {
    const world = generateWorldDraft({ seed: 88 }).world;
    const race = RACES_BY_ID.get('r-omlopp')!;
    const firstSeason = selectEventField(world, race, 1);
    expect(firstSeason.wildcards).toEqual([]);
    expect(firstSeason.teamIds).toHaveLength(10);
    expect(firstSeason.teamIds.every((teamId) => world.teamSeasons[teamId].division === 'world')).toBe(true);

    const proLeader = rankDivision(world, 'pro', 1)[0].teamId;
    world.teamSeasons[proLeader].reputation = WILDCARD_MIN_REPUTATION;
    const invited = selectEventField(world, race, 1);
    expect(invited.wildcards).toHaveLength(1);
    expect(invited.wildcards[0].teamId).toBe(proLeader);
    expect(invited.wildcards[0].reason).toContain('Pro Tour #1');
    expect(selectEventField(world, race, 1)).toEqual(invited);
  });

  it('promotes top two and relegates bottom two exactly once, then resets metrics', () => {
    const world = generateWorldDraft({ seed: 99 }).world;
    const proBefore = rankDivision(world, 'pro', 1);
    const worldBefore = rankDivision(world, 'world', 1);
    proBefore.forEach((row, index) => (world.teamSeasons[row.teamId].rankingPoints = 100 - index));
    worldBefore.forEach((row, index) => (world.teamSeasons[row.teamId].rankingPoints = 100 - index));

    const proRanked = rankDivision(world, 'pro', 1);
    const worldRanked = rankDivision(world, 'world', 1);
    const movement = applyDivisionMovement(world, 1);
    expect(movement.promotedTeamIds).toEqual(proRanked.slice(0, 2).map((row) => row.teamId));
    expect(movement.relegatedTeamIds).toEqual(worldRanked.slice(-2).map((row) => row.teamId));
    expect(movement.promotedTeamIds.every((teamId) => world.teamSeasons[teamId].division === 'world')).toBe(true);
    expect(movement.relegatedTeamIds.every((teamId) => world.teamSeasons[teamId].division === 'pro')).toBe(true);
    expect(applyDivisionMovement(world, 1)).toBe(movement);
    expect(world.history.promotions).toHaveLength(1);
    expect(world.history.teamChampions).toHaveLength(2);

    resetDivisionCompetition(world);
    expect(Object.values(world.teamSeasons).every((state) => state.rankingPoints === 0 && state.wins === 0)).toBe(true);
  });

  it('deterministically gives unplayed events results and points in both divisions', () => {
    const first = generateWorldDraft({ seed: 123 });
    const second = generateWorldDraft({ seed: 123 });
    simulateBackgroundCompetition(first.world, 1, first.riders, new Set());
    simulateBackgroundCompetition(second.world, 1, second.riders, new Set());

    expect(first.world.teamSeasons).toEqual(second.world.teamSeasons);
    expect(first.world.history.raceWinners).toEqual(second.world.history.raceWinners);
    expect(first.world.history.raceWinners).toHaveLength(30);
    for (const division of ['world', 'pro'] as const) {
      expect(rankDivision(first.world, division, 1).some((row) => row.points > 0)).toBe(true);
    }
  });
});