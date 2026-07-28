import { describe, expect, it } from 'vitest';
import { WORLD_BASE_FREE_AGENT_COUNT, WORLD_ROSTER_SIZE } from '../data/tuning.ts';
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
});