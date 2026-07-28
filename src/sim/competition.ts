import {
  BACKGROUND_TEAM_SCORE_NOISE,
  DIVISION_MOVEMENT_COUNT,
  SEASON_EVENT_POINTS,
  WILDCARD_MIN_REPUTATION,
  WILDCARD_PODIUM_REPUTATION_GAIN,
  WILDCARD_WIN_REPUTATION_GAIN,
} from '../data/tuning.ts';
import { PRO_CALENDAR, RACES_BY_ID, WORLD_CALENDAR, calendarForDivision } from '../data/races.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import type {
  DivisionId,
  EventField,
  PromotionRecord,
  Race,
  Rider,
  TeamIdentity,
  TeamSeasonState,
  WorldState,
} from '../data/types.ts';
import { deriveSeed } from './rng.ts';
import type { SeasonResult } from './season.ts';
import { baseScore } from './stageSim.ts';
import type { TourState } from './standings.ts';

export interface DivisionStanding {
  teamId: string;
  points: number;
  wins: number;
  bestPrestigeResult: number;
}

function seededOrder(worldSeed: number, season: number, division: DivisionId, teamId: string): number {
  return deriveSeed(worldSeed, 'division-tiebreak', season, division, teamId);
}

export function rankDivision(
  world: WorldState,
  division: DivisionId,
  season: number,
): DivisionStanding[] {
  return world.teams
    .filter((team) => world.teamSeasons[team.id]?.division === division)
    .map((team) => {
      const state = world.teamSeasons[team.id];
      return {
        teamId: team.id,
        points: state.rankingPoints,
        wins: state.wins,
        bestPrestigeResult: state.bestPrestigeResult,
      };
    })
    .sort(
      (left, right) =>
        right.points - left.points ||
        right.wins - left.wins ||
        right.bestPrestigeResult - left.bestPrestigeResult ||
        seededOrder(world.seed, season, division, left.teamId) - seededOrder(world.seed, season, division, right.teamId),
    );
}

function invitationReason(team: TeamIdentity, state: TeamSeasonState, rank: number): string {
  const home = team.country ? ` · ${team.country}` : '';
  return `Pro Tour #${rank} · reputation ${state.reputation}${home}`;
}

export function selectEventField(world: WorldState, race: Race, season: number): EventField {
  const division = race.eligibility.division;
  const wildcardSlots = race.eligibility.wildcardSlots ?? 0;
  const standardSlots = Math.max(0, race.eligibility.fieldSize - wildcardSlots);
  const ranked = rankDivision(world, division, season);
  const standardTeamIds = ranked.slice(0, standardSlots).map((row) => row.teamId);
  const wildcards = [] as EventField['wildcards'];

  if (division === 'world' && wildcardSlots > 0) {
    const proRanks = rankDivision(world, 'pro', season);
    for (let index = 0; index < proRanks.length && wildcards.length < wildcardSlots; index++) {
      const row = proRanks[index];
      const state = world.teamSeasons[row.teamId];
      if (state.reputation < WILDCARD_MIN_REPUTATION) continue;
      const team = world.teams.find((entry) => entry.id === row.teamId)!;
      wildcards.push({ teamId: row.teamId, reason: invitationReason(team, state, index + 1) });
    }
  }

  return {
    season,
    raceId: race.id,
    teamIds: [...standardTeamIds, ...wildcards.map((invite) => invite.teamId)],
    wildcards,
  };
}

export function prepareCompetitionSeason(world: WorldState, season: number): void {
  const existing = new Set(world.eventFields.filter((field) => field.season === season).map((field) => field.raceId));
  for (const raceId of [...WORLD_CALENDAR, ...PRO_CALENDAR]) {
    if (!existing.has(raceId)) world.eventFields.push(selectEventField(world, RACES_BY_ID.get(raceId)!, season));
  }
}

export function calendarForTeam(world: WorldState, teamId: string, season: number): string[] {
  prepareCompetitionSeason(world, season);
  const division = world.teamSeasons[teamId].division;
  const calendar = [...calendarForDivision(division)];
  if (division === 'world') return calendar;
  const invitations = world.eventFields.filter(
    (field) => field.season === season && field.wildcards.some((invite) => invite.teamId === teamId),
  );
  for (const invitation of invitations) {
    const worldIndex = WORLD_CALENDAR.indexOf(invitation.raceId);
    const insertAt = Math.min(calendar.length, Math.round(((worldIndex + 1) / WORLD_CALENDAR.length) * calendar.length));
    calendar.splice(insertAt, 0, invitation.raceId);
  }
  return calendar;
}

export function recordDivisionEvent(
  world: WorldState,
  season: number,
  race: Race,
  result: SeasonResult,
  riderPointGains: ReadonlyMap<string, number>,
  riders: readonly Rider[],
  tour?: TourState,
): void {
  const teamByRider = new Map(riders.map((rider) => [rider.id, rider.teamId]));
  for (const [riderId, points] of riderPointGains) {
    const teamId = teamByRider.get(riderId);
    if (!teamId) continue;
    const state = world.teamSeasons[teamId];
    if (state.division === race.eligibility.division) {
      state.rankingPoints += Math.round(points * race.eligibility.divisionPointsScale);
    }
  }
  const winnerTeamId = teamByRider.get(result.winnerId);
  if (!winnerTeamId) return;
  const winnerState = world.teamSeasons[winnerTeamId];
  if (winnerState.division === race.eligibility.division) {
    winnerState.wins += 1;
    winnerState.bestPrestigeResult = Math.max(winnerState.bestPrestigeResult, race.prestige);
  }
  if (!world.history.raceWinners.some((entry) => entry.season === season && entry.raceId === race.id)) {
    world.history.raceWinners.push({ season, raceId: race.id, riderId: result.winnerId, teamId: winnerTeamId });
  }
  tour?.results.forEach((stageResult, index) => {
    const stageWinner = stageResult.order.find((entry) => !entry.dnf);
    const teamId = stageWinner ? teamByRider.get(stageWinner.riderId) : undefined;
    const stageId = race.stageIds[index];
    if (!stageWinner || !teamId || !stageId) return;
    if (!world.history.stageWinners.some((entry) => entry.season === season && entry.stageId === stageId)) {
      world.history.stageWinners.push({ season, raceId: race.id, stageId, riderId: stageWinner.riderId, teamId });
    }
  });
  const wildcardTeamIds = new Set(
    world.eventFields
      .find((field) => field.season === season && field.raceId === race.id)
      ?.wildcards.map((invite) => invite.teamId) ?? [],
  );
  const bestWildcardPosition = new Map<string, number>();
  result.classification.slice(0, 3).forEach((row, index) => {
    const teamId = teamByRider.get(row.riderId);
    if (teamId && wildcardTeamIds.has(teamId) && !bestWildcardPosition.has(teamId)) {
      bestWildcardPosition.set(teamId, index + 1);
    }
  });
  for (const [teamId, position] of bestWildcardPosition) {
    world.teamSeasons[teamId].reputation += position === 1 ? WILDCARD_WIN_REPUTATION_GAIN : WILDCARD_PODIUM_REPUTATION_GAIN;
  }
}

function raceScore(rider: Rider, race: Race): number {
  return race.stageIds.reduce((sum, stageId) => sum + baseScore(rider, STAGES_BY_ID.get(stageId)!), 0) / race.stageIds.length;
}

export function simulateBackgroundCompetition(
  world: WorldState,
  season: number,
  riders: readonly Rider[],
  playedRaceIds: ReadonlySet<string>,
): void {
  prepareCompetitionSeason(world, season);
  for (const field of world.eventFields.filter((entry) => entry.season === season && !playedRaceIds.has(entry.raceId))) {
    if (world.history.raceWinners.some((entry) => entry.season === season && entry.raceId === field.raceId)) continue;
    const race = RACES_BY_ID.get(field.raceId)!;
    const rankedTeams = field.teamIds
      .map((teamId) => {
        const squad = riders
          .filter((rider) => rider.teamId === teamId)
          .map((rider) => ({ rider, score: raceScore(rider, race) }))
          .sort((left, right) => right.score - left.score);
        const strength = squad.slice(0, 3).reduce((sum, row) => sum + row.score, 0) / Math.max(1, Math.min(3, squad.length));
        const noise = ((deriveSeed(world.seed, 'background-race', season, race.id, teamId) % 1001) / 500 - 1)
          * BACKGROUND_TEAM_SCORE_NOISE;
        return { teamId, riderId: squad[0]?.rider.id, score: strength + noise };
      })
      .filter((row) => row.riderId)
      .sort((left, right) => right.score - left.score);
    rankedTeams.forEach((row, index) => {
      if (world.teamSeasons[row.teamId].division !== race.eligibility.division) return;
      const base = SEASON_EVENT_POINTS[index];
      if (base !== undefined) {
        world.teamSeasons[row.teamId].rankingPoints += Math.round(
          (base * race.prestige * race.eligibility.divisionPointsScale) / 100,
        );
      }
    });
    const winner = rankedTeams[0];
    if (!winner?.riderId) continue;
    const winnerState = world.teamSeasons[winner.teamId];
    if (winnerState.division === race.eligibility.division) {
      winnerState.wins += 1;
      winnerState.bestPrestigeResult = Math.max(winnerState.bestPrestigeResult, race.prestige);
    } else if (field.wildcards.some((invite) => invite.teamId === winner.teamId)) {
      winnerState.reputation += WILDCARD_WIN_REPUTATION_GAIN;
    }
    world.history.raceWinners.push({ season, raceId: race.id, riderId: winner.riderId, teamId: winner.teamId });
    for (const stageId of race.stageIds) {
      world.history.stageWinners.push({ season, raceId: race.id, stageId, riderId: winner.riderId, teamId: winner.teamId });
    }
  }
}

export function applyDivisionMovement(world: WorldState, season: number): PromotionRecord {
  const existing = world.history.promotions.find((record) => record.season === season);
  if (existing) return existing;
  const pro = rankDivision(world, 'pro', season);
  const top = rankDivision(world, 'world', season);
  const promotedTeamIds = pro.slice(0, DIVISION_MOVEMENT_COUNT).map((row) => row.teamId);
  const relegatedTeamIds = top.slice(-DIVISION_MOVEMENT_COUNT).map((row) => row.teamId);
  const record = { season, promotedTeamIds, relegatedTeamIds };

  promotedTeamIds.forEach((teamId) => (world.teamSeasons[teamId].division = 'world'));
  relegatedTeamIds.forEach((teamId) => (world.teamSeasons[teamId].division = 'pro'));
  world.history.promotions.push(record);

  const champions: [DivisionId, string | undefined][] = [
    ['world', top[0]?.teamId],
    ['pro', pro[0]?.teamId],
  ];
  for (const [division, teamId] of champions) {
    if (!teamId) continue;
    world.history.teamChampions.push({ season, division, teamId });
  }
  const winnerCounts = new Map<string, number>();
  for (const winner of world.history.raceWinners.filter((entry) => entry.season === season)) {
    winnerCounts.set(winner.riderId, (winnerCounts.get(winner.riderId) ?? 0) + 1);
  }
  const riderChampionId = [...winnerCounts.entries()]
    .sort((left, right) => right[1] - left[1] || deriveSeed(world.seed, 'rider-champion', season, left[0]) - deriveSeed(world.seed, 'rider-champion', season, right[0]))[0]?.[0];
  world.history.seasons.push({
    season,
    riderChampionId,
    teamChampionIds: { world: top[0]?.teamId, pro: pro[0]?.teamId },
  });
  return record;
}

export function resetDivisionCompetition(world: WorldState): void {
  for (const state of Object.values(world.teamSeasons)) {
    state.rankingPoints = 0;
    state.wins = 0;
    state.bestPrestigeResult = 0;
  }
}

export interface DivisionStatus {
  division: DivisionId;
  rank: number;
  teamCount: number;
  points: number;
  lineRank: number;
  pointsToLine: number;
}

export function divisionStatus(world: WorldState, teamId: string, season: number): DivisionStatus {
  const division = world.teamSeasons[teamId].division;
  const rows = rankDivision(world, division, season);
  const rankIndex = rows.findIndex((row) => row.teamId === teamId);
  const rank = rankIndex + 1;
  const lineRank = division === 'pro' ? Math.min(DIVISION_MOVEMENT_COUNT, rows.length) : Math.max(1, rows.length - DIVISION_MOVEMENT_COUNT);
  const points = rows[rankIndex]?.points ?? 0;
  const linePoints = rows[lineRank - 1]?.points ?? 0;
  return {
    division,
    rank,
    teamCount: rows.length,
    points,
    lineRank,
    pointsToLine: division === 'pro' || rank > lineRank ? Math.max(0, linePoints - points) : 0,
  };
}