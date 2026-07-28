import {
  WORLD_BASE_FREE_AGENT_COUNT,
  WORLD_JERSEY_CONTRAST_MIN,
  WORLD_PROPOSAL_MAX_RATING,
  WORLD_PROPOSAL_RATING_SPREAD,
  WORLD_PRO_MAX_RATING,
  WORLD_PRO_MAX_STAT,
  WORLD_PRO_TEAM_COUNT,
  WORLD_ROSTER_SIZE,
  WORLD_SQUAD_PROPOSAL_COUNT,
  WORLD_STARTER_EXPERIENCED_AGE_MIN,
  WORLD_STARTER_YOUNG_AGE_MAX,
  WORLD_TEAM_COLOR_MIN_DISTANCE,
  WORLD_TOP_TEAM_COUNT,
} from '../data/tuning.ts';
import type { GeneratedWorldDraft, TeamIdentity } from '../data/types.ts';
import { riderRating } from './rating.ts';

export interface WorldValidationResult {
  valid: boolean;
  errors: string[];
}

function colorDistance(left: number, right: number): number {
  const red = ((left >> 16) & 0xff) - ((right >> 16) & 0xff);
  const green = ((left >> 8) & 0xff) - ((right >> 8) & 0xff);
  const blue = (left & 0xff) - (right & 0xff);
  return Math.sqrt(red * red + green * green + blue * blue);
}

function validateDivisionColors(teams: TeamIdentity[], errors: string[]): void {
  for (let left = 0; left < teams.length; left++) {
    for (let right = left + 1; right < teams.length; right++) {
      if (colorDistance(teams[left].primaryColor, teams[right].primaryColor) < WORLD_TEAM_COLOR_MIN_DISTANCE) {
        errors.push(`Team colors are too close: ${teams[left].id}, ${teams[right].id}`);
      }
    }
  }
}

export function validateWorld(draft: GeneratedWorldDraft): WorldValidationResult {
  const errors: string[] = [];
  const { world, riders, proposals } = draft;
  const expectedTeams = WORLD_TOP_TEAM_COUNT + WORLD_PRO_TEAM_COUNT;
  if (world.teams.length !== expectedTeams) errors.push(`Expected ${expectedTeams} teams, got ${world.teams.length}`);
  if (world.teams.filter((team) => team.isPlayer).length !== 1) errors.push('Expected exactly one player team');
  const uniqueTeamIds = new Set(world.teams.map((team) => team.id));
  if (uniqueTeamIds.size !== world.teams.length) errors.push('Team IDs are not unique');
  if (new Set(world.teams.map((team) => team.name)).size !== world.teams.length) errors.push('Team names are not unique');
  if (new Set(world.teams.map((team) => team.shortName)).size !== world.teams.length) errors.push('Team abbreviations are not unique');
  for (const team of world.teams) {
    if (!/^[A-Z]{3}$/.test(team.shortName)) errors.push(`${team.id} has an invalid abbreviation`);
    if (colorDistance(team.primaryColor, team.accentColor) < WORLD_JERSEY_CONTRAST_MIN) {
      errors.push(`${team.id} has insufficient jersey contrast`);
    }
  }
  if (new Set(riders.map((rider) => rider.id)).size !== riders.length) errors.push('Rider IDs are not unique');
  if (new Set(riders.map((rider) => rider.name)).size !== riders.length) errors.push('Rider names are not unique');

  const worldTeams = world.teams.filter((team) => world.teamSeasons[team.id]?.division === 'world');
  const proTeams = world.teams.filter((team) => world.teamSeasons[team.id]?.division === 'pro');
  if (worldTeams.length !== WORLD_TOP_TEAM_COUNT) errors.push('Top-division team count is invalid');
  if (proTeams.length !== WORLD_PRO_TEAM_COUNT) errors.push('Lower-division team count is invalid');
  validateDivisionColors(worldTeams, errors);
  validateDivisionColors(proTeams, errors);

  for (const team of world.teams.filter((entry) => !entry.isPlayer)) {
    const roster = riders.filter((rider) => rider.teamId === team.id);
    const rosterSize = roster.length;
    if (rosterSize !== WORLD_ROSTER_SIZE) errors.push(`${team.id} has ${rosterSize} riders`);
    if (world.teamSeasons[team.id].division === 'pro') {
      if (roster.some((rider) => riderRating(rider) > WORLD_PRO_MAX_RATING)) errors.push(`${team.id} has a World Tour-level rider`);
      if (roster.some((rider) => Math.max(...Object.values(rider.stats)) > WORLD_PRO_MAX_STAT)) errors.push(`${team.id} exceeds the Pro stat ceiling`);
    }
  }
  const knownTeamIds = new Set(world.teams.map((team) => team.id));
  for (const rider of riders) {
    if (rider.teamId !== null && !knownTeamIds.has(rider.teamId)) errors.push(`${rider.id} has an unknown team`);
  }

  if (proposals.length !== WORLD_SQUAD_PROPOSAL_COUNT) errors.push('Squad proposal count is invalid');
  const proposalRiderIds = proposals.flatMap((proposal) => proposal.riderIds);
  if (new Set(proposalRiderIds).size !== proposalRiderIds.length) errors.push('Squad proposals share riders');
  const riderById = new Map(riders.map((rider) => [rider.id, rider]));
  for (const proposal of proposals) {
    const squad = proposal.riderIds.map((id) => riderById.get(id)).filter((rider) => rider !== undefined);
    if (squad.length !== WORLD_ROSTER_SIZE) errors.push(`${proposal.id} has an invalid roster size`);
    if (!squad.some((rider) => rider.age <= WORLD_STARTER_YOUNG_AGE_MAX)) errors.push(`${proposal.id} has no young rider`);
    if (!squad.some((rider) => rider.age >= WORLD_STARTER_EXPERIENCED_AGE_MIN)) errors.push(`${proposal.id} has no experienced rider`);
    if (squad.some((rider) => riderRating(rider) > WORLD_PROPOSAL_MAX_RATING)) errors.push(`${proposal.id} contains an elite rider`);
    const supportCount = proposal.archetypes.filter((archetype) =>
      ['rouleur', 'leadout', 'breakaway', 'domestique'].includes(archetype),
    ).length;
    if (supportCount < 2) errors.push(`${proposal.id} lacks support riders`);
  }
  if (new Set(proposals.map((proposal) => proposal.archetypes.join(','))).size !== proposals.length) {
    errors.push('Squad proposals do not have distinct archetype mixes');
  }
  const proposalTotals = proposals.map((proposal) => proposal.totalRating);
  if (proposalTotals.length > 0 && Math.max(...proposalTotals) - Math.min(...proposalTotals) > WORLD_PROPOSAL_RATING_SPREAD) {
    errors.push('Squad proposal strength spread is too large');
  }
  const unsignedCount = riders.filter((rider) => rider.teamId === null).length;
  const expectedUnsigned = WORLD_BASE_FREE_AGENT_COUNT + WORLD_SQUAD_PROPOSAL_COUNT * WORLD_ROSTER_SIZE;
  if (unsignedCount !== expectedUnsigned) errors.push(`Expected ${expectedUnsigned} unsigned riders, got ${unsignedCount}`);
  return { valid: errors.length === 0, errors };
}