import {
  WORLD_BASE_FREE_AGENT_COUNT,
  WORLD_GENERATION_MAX_ATTEMPTS,
  WORLD_PLAYER_STARTING_BUDGET,
  WORLD_PROPOSAL_MAX_RATING,
  WORLD_PROPOSAL_RATING_SPREAD,
  WORLD_PRO_TEAM_BUDGET,
  WORLD_PRO_REPUTATION,
  WORLD_ROSTER_SIZE,
  WORLD_SCHEMA_VERSION,
  WORLD_SQUAD_PROPOSAL_COUNT,
  WORLD_STARTER_EXPERIENCED_AGE_MIN,
  WORLD_STARTER_YOUNG_AGE_MAX,
  WORLD_TOP_REPUTATION,
  WORLD_TOP_TEAM_BUDGET,
  WORLD_TOP_TEAM_COUNT,
} from '../data/tuning.ts';
import type {
  GeneratedWorldDraft,
  Rider,
  SquadProposal,
  TeamIdentity,
  TeamSeasonState,
  TeamPhilosophy,
  WorldState,
} from '../data/types.ts';
import { PHILOSOPHY_ROSTERS, type RiderArchetype } from '../data/worldTemplates.ts';
import { riderRating, riderSalary } from './rating.ts';
import { deriveSeed, Rng } from './rng.ts';
import { generateWorldRider, type RiderGenerationTier } from './riderGeneration.ts';
import { DEFAULT_PLAYER_TEAM, generateTeamIdentities, type PlayerTeamInput } from './teamGeneration.ts';

export interface WorldGenerationOptions {
  seed: number;
  player?: PlayerTeamInput;
}

function proposalArchetypes(philosophy: TeamPhilosophy, index: number): RiderArchetype[] {
  const base = PHILOSOPHY_ROSTERS[philosophy];
  if (index === 0) return [...base];
  if (index === 1) return [base[0], base[1], base[2], 'breakaway', 'domestique', 'rouleur', 'leadout', base[3]];
  return [base[0], base[1], base[2], 'puncheur', 'domestique', 'domestique', 'rouleur', 'leadout'];
}

function generateRiderGroup(
  seed: number,
  stream: string,
  idPrefix: string,
  teamId: string | null,
  philosophy: TeamPhilosophy,
  tier: RiderGenerationTier,
  archetypes: readonly RiderArchetype[],
  usedNames: Set<string>,
  starterAges = false,
): Rider[] {
  const rng = new Rng(deriveSeed(seed, 'roster', stream));
  return archetypes.map((archetype, index) => {
    let age: number | undefined;
    if (starterAges && index === 1) age = 19 + rng.int(WORLD_STARTER_YOUNG_AGE_MAX - 18);
    if (starterAges && index === 4) age = WORLD_STARTER_EXPERIENCED_AGE_MIN + rng.int(6);
    return generateWorldRider({
      id: `${idPrefix}-${String(index + 1).padStart(2, '0')}`,
      teamId,
      archetype,
      tier,
      philosophy,
      rng,
      usedNames,
      age,
    });
  });
}

function makeProposal(id: string, riders: Rider[], archetypes: readonly RiderArchetype[]): SquadProposal {
  const ratings = riders.map(riderRating);
  return {
    id,
    riderIds: riders.map((rider) => rider.id),
    archetypes: [...archetypes],
    totalRating: ratings.reduce((sum, rating) => sum + rating, 0),
    wageBill: riders.reduce((sum, rider) => sum + riderSalary(rider), 0),
    averageAge: Math.round((riders.reduce((sum, rider) => sum + rider.age, 0) / riders.length) * 10) / 10,
  };
}

function teamSeasonState(team: TeamIdentity, teamIndex: number): TeamSeasonState {
  const division = teamIndex < WORLD_TOP_TEAM_COUNT ? 'world' : 'pro';
  return {
    division,
    rankingPoints: 0,
    reputation: division === 'world' ? WORLD_TOP_REPUTATION : WORLD_PRO_REPUTATION,
    budget: team.isPlayer
      ? WORLD_PLAYER_STARTING_BUDGET
      : division === 'world'
        ? WORLD_TOP_TEAM_BUDGET
        : WORLD_PRO_TEAM_BUDGET,
  };
}

export function generateWorldDraft(options: WorldGenerationOptions): GeneratedWorldDraft {
  const seed = options.seed >>> 0;
  const player = options.player ?? DEFAULT_PLAYER_TEAM;
  const teams = generateTeamIdentities(seed, player);
  const usedNames = new Set<string>();
  const riders: Rider[] = [];
  const seedTag = seed.toString(36);
  const aiTeams = teams.filter((team) => !team.isPlayer);

  aiTeams.forEach((team, teamIndex) => {
    const tier: RiderGenerationTier = teamIndex < WORLD_TOP_TEAM_COUNT ? 'world' : 'pro';
    riders.push(
      ...generateRiderGroup(
        seed,
        team.id,
        `rider-${seedTag}-${team.id}`,
        team.id,
        team.philosophy,
        tier,
        PHILOSOPHY_ROSTERS[team.philosophy],
        usedNames,
      ),
    );
  });

  const proposalRiders: Rider[][] = [];
  const proposals: SquadProposal[] = [];
  const proposalAttempts: number[] = [];
  for (let index = 0; index < WORLD_SQUAD_PROPOSAL_COUNT; index++) {
    const archetypes = proposalArchetypes(player.philosophy, index);
    let acceptedGroup: Rider[] | undefined;
    let acceptedProposal: SquadProposal | undefined;
    for (let attempt = 0; attempt < WORLD_GENERATION_MAX_ATTEMPTS; attempt++) {
      const attemptNames = new Set(usedNames);
      const group = generateRiderGroup(
        seed,
        `proposal-${index + 1}-attempt-${attempt}`,
        `rider-${seedTag}-proposal-${index + 1}`,
        null,
        player.philosophy,
        'proposal',
        archetypes,
        attemptNames,
        true,
      );
      const proposal = makeProposal(`proposal-${seedTag}-${index + 1}`, group, archetypes);
      const proposalTotals = [...proposals.map((entry) => entry.totalRating), proposal.totalRating];
      const hasEliteRider = group.some((rider) => riderRating(rider) > WORLD_PROPOSAL_MAX_RATING);
      if (!hasEliteRider && Math.max(...proposalTotals) - Math.min(...proposalTotals) <= WORLD_PROPOSAL_RATING_SPREAD) {
        acceptedGroup = group;
        acceptedProposal = proposal;
        group.forEach((rider) => usedNames.add(rider.name));
        proposalAttempts.push(attempt + 1);
        break;
      }
    }
    if (!acceptedGroup || !acceptedProposal) throw new Error(`Unable to generate balanced squad proposal ${index + 1}`);
    proposalRiders.push(acceptedGroup);
    proposals.push(acceptedProposal);
  }
  riders.push(...proposalRiders.flat());

  const freeArchetypes = Array.from(
    { length: WORLD_BASE_FREE_AGENT_COUNT },
    (_, index) => PHILOSOPHY_ROSTERS.balanced[index % WORLD_ROSTER_SIZE],
  );
  riders.push(
    ...generateRiderGroup(
      seed,
      'free-agents',
      `rider-${seedTag}-free`,
      null,
      'balanced',
      'free',
      freeArchetypes,
      usedNames,
    ),
  );

  const teamSeasons = Object.fromEntries(teams.map((team, index) => [team.id, teamSeasonState(team, index)]));
  const world: WorldState = {
    schemaVersion: WORLD_SCHEMA_VERSION,
    seed,
    teams,
    teamSeasons,
    history: { seasons: [], raceWinners: [], promotions: [], teamChampions: [] },
  };
  return { world, riders, proposals, diagnostics: { proposalAttempts } };
}

export function acceptSquadProposal(draft: GeneratedWorldDraft, proposalId: string): GeneratedWorldDraft {
  const selected = draft.proposals.find((proposal) => proposal.id === proposalId);
  const playerTeam = draft.world.teams.find((team) => team.isPlayer);
  if (!selected || !playerTeam) throw new Error('Cannot accept an unknown squad proposal');
  const selectedIds = new Set(selected.riderIds);
  const riders = draft.riders.map((rider) => {
    if (!selectedIds.has(rider.id)) return rider;
    return { ...rider, teamId: playerTeam.id, salary: riderSalary(rider), contractSeasonsLeft: 3 };
  });
  return { world: draft.world, riders, proposals: [selected], diagnostics: draft.diagnostics };
}