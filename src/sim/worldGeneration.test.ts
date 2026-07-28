import { describe, expect, it } from 'vitest';
import { WORLD_BASE_FREE_AGENT_COUNT, WORLD_PRO_MAX_RATING, WORLD_PRO_MAX_STAT, WORLD_ROSTER_SIZE } from '../data/tuning.ts';
import { riderRating } from './rating.ts';
import type { TeamPhilosophy } from '../data/types.ts';
import { validateWorld } from './worldBalance.ts';
import { acceptSquadProposal, generateWorldDraft } from './worldGeneration.ts';

const PHILOSOPHIES: TeamPhilosophy[] = ['mountain', 'classics', 'sprint', 'development', 'balanced', 'opportunist'];

describe('generated world foundation', () => {
  it('replays byte-equivalent identities, riders, and proposals', () => {
    const first = generateWorldDraft({ seed: 8675309 });
    const replay = generateWorldDraft({ seed: 8675309 });

    expect(JSON.stringify(replay)).toBe(JSON.stringify(first));
  });

  it('changes generated content with the world seed', () => {
    const first = generateWorldDraft({ seed: 100 });
    const second = generateWorldDraft({ seed: 101 });

    expect(second.world.teams).not.toEqual(first.world.teams);
    expect(second.riders).not.toEqual(first.riders);
    expect(second.proposals).not.toEqual(first.proposals);
  });

  it('satisfies world and proposal constraints across 100 seeds', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const result = validateWorld(generateWorldDraft({ seed }));
      expect(result.errors, `seed ${seed}: ${result.errors.join('; ')}`).toEqual([]);
    }
  });

  it('builds valid, reproducible proposals for every philosophy', () => {
    for (const philosophy of PHILOSOPHIES) {
      for (let seed = 1; seed <= 20; seed++) {
        const options = { seed, player: { ...generateWorldDraft({ seed }).world.teams.find((team) => team.isPlayer)!, philosophy } };
        const first = generateWorldDraft(options);
        const replay = generateWorldDraft(options);
        expect(validateWorld(first).errors, `${philosophy} seed ${seed}`).toEqual([]);
        expect(replay.proposals).toEqual(first.proposals);
      }
    }
  });

  it('contracts the accepted proposal and leaves the other candidates unsigned', () => {
    const draft = generateWorldDraft({ seed: 42 });
    const selected = draft.proposals[1];
    const accepted = acceptSquadProposal(draft, selected.id);
    const playerTeam = accepted.world.teams.find((team) => team.isPlayer)!;

    expect(accepted.riders.filter((rider) => rider.teamId === playerTeam.id)).toHaveLength(WORLD_ROSTER_SIZE);
    expect(accepted.riders.filter((rider) => rider.teamId === null)).toHaveLength(
      WORLD_BASE_FREE_AGENT_COUNT + WORLD_ROSTER_SIZE * 2,
    );
    expect(accepted.riders.filter((rider) => rider.teamId === playerTeam.id).every((rider) => rider.salary !== undefined)).toBe(true);
  });

  it('keeps Pro Tour riders below World Tour-level ceilings', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const draft = generateWorldDraft({ seed });
      const proTeamIds = new Set(draft.world.teams
        .filter((team) => draft.world.teamSeasons[team.id].division === 'pro')
        .map((team) => team.id));
      const proRiders = draft.riders.filter((rider) => rider.teamId && proTeamIds.has(rider.teamId));
      expect(Math.max(...proRiders.map(riderRating))).toBeLessThanOrEqual(WORLD_PRO_MAX_RATING);
      expect(Math.max(...proRiders.flatMap((rider) => Object.values(rider.stats)))).toBeLessThanOrEqual(WORLD_PRO_MAX_STAT);
    }
  });

  it('keeps generated division names varied and nationally coherent', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const draft = generateWorldDraft({ seed });
      for (const division of ['world', 'pro'] as const) {
        const teamIds = new Set(draft.world.teams
          .filter((team) => draft.world.teamSeasons[team.id].division === division)
          .map((team) => team.id));
        const riders = draft.riders.filter((rider) => rider.teamId && teamIds.has(rider.teamId));
        const firstCounts = new Map<string, number>();
        const surnameCounts = new Map<string, number>();
        for (const rider of riders) {
          const [first, ...surnameParts] = rider.name.split(' ');
          const surname = surnameParts.join(' ');
          firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
          surnameCounts.set(surname, (surnameCounts.get(surname) ?? 0) + 1);
        }
        expect(Math.max(...firstCounts.values())).toBeLessThanOrEqual(2);
        expect(Math.max(...surnameCounts.values())).toBeLessThanOrEqual(2);
        expect(new Set(riders.map((rider) => rider.nationality)).size).toBeGreaterThanOrEqual(10);
      }
    }
  });
});