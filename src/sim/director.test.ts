import { describe, expect, it } from 'vitest';
import { acceptSquadProposal, generateWorldDraft } from './worldGeneration.ts';
import { directorPlanFor, prepareDirectorPlans } from './director.ts';

describe('Rival Director plans', () => {
  it('creates deterministic targets, leaders, reasons, and preferences for every team', () => {
    const firstDraft = generateWorldDraft({ seed: 456 });
    const secondDraft = generateWorldDraft({ seed: 456 });
    const first = acceptSquadProposal(firstDraft, firstDraft.proposals[0].id);
    const second = acceptSquadProposal(secondDraft, secondDraft.proposals[0].id);
    prepareDirectorPlans(first.world, 1, first.riders);
    prepareDirectorPlans(second.world, 1, second.riders);

    expect(first.world.directorPlans).toEqual(second.world.directorPlans);
    expect(first.world.directorPlans).toHaveLength(first.world.teams.length);
    for (const plan of first.world.directorPlans) {
      expect(plan.targets).toHaveLength(3);
      expect(plan.targets.every((target) => target.reason.length > 0)).toBe(true);
      expect(plan.targets.every((target) => first.riders.some((rider) => rider.id === target.leaderId && rider.teamId === plan.teamId))).toBe(true);
    }
    expect(directorPlanFor(first.world, first.world.teams[0].id, 1)).toBeDefined();

    prepareDirectorPlans(first.world, 1, first.riders);
    expect(first.world.directorPlans).toHaveLength(first.world.teams.length);
  });
});