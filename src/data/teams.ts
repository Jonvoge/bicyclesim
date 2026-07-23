import { RIDERS } from './riders.ts';
import type { Team } from './types.ts';

/**
 * Teams (SPEC §4). Proxy names only (SPEC §9). riderIds are derived from the
 * roster so the two never drift apart.
 */

function riderIdsFor(teamId: string): string[] {
  return RIDERS.filter((r) => r.teamId === teamId).map((r) => r.id);
}

export const TEAMS: Team[] = [
  { id: 't-grenoble', name: 'Grenoble Grenadiers', isPlayer: true, riderIds: riderIdsFor('t-grenoble') },
  { id: 't-vesma', name: 'Vesma Lease-a-Bike', isPlayer: false, riderIds: riderIdsFor('t-vesma') },
  { id: 't-uad', name: 'UAD Emirates', isPlayer: false, riderIds: riderIdsFor('t-uad') },
  { id: 't-soudo', name: 'Soudo Quick-Track', isPlayer: false, riderIds: riderIdsFor('t-soudo') },
  { id: 't-movistrella', name: 'Movistrella', isPlayer: false, riderIds: riderIdsFor('t-movistrella') },
  { id: 't-bora', name: 'Bora Hansburg', isPlayer: false, riderIds: riderIdsFor('t-bora') },
  { id: 't-lido', name: 'Lido-Trec', isPlayer: false, riderIds: riderIdsFor('t-lido') },
  { id: 't-astara', name: 'Astara Cycling', isPlayer: false, riderIds: riderIdsFor('t-astara') },
];

export const TEAMS_BY_ID: Map<string, Team> = new Map(TEAMS.map((t) => [t.id, t]));

export const PLAYER_TEAM: Team = TEAMS.find((t) => t.isPlayer)!;
