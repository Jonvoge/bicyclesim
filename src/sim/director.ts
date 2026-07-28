import { calendarForDivision, RACES_BY_ID } from '../data/races.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import type {
  DirectorTacticalPreference,
  Race,
  Rider,
  RivalDirectorPlan,
  TeamPhilosophy,
  WorldState,
} from '../data/types.ts';
import { deriveSeed } from './rng.ts';
import { baseScore } from './stageSim.ts';

const PREFERENCE_BY_PHILOSOPHY: Record<TeamPhilosophy, DirectorTacticalPreference> = {
  mountain: 'gc-protection',
  classics: 'classics-aggression',
  sprint: 'sprint-control',
  development: 'break-hunting',
  balanced: 'gc-protection',
  opportunist: 'break-hunting',
};

function riderRaceScore(rider: Rider, race: Race): number {
  return race.stageIds.reduce((sum, stageId) => sum + baseScore(rider, STAGES_BY_ID.get(stageId)!), 0) / race.stageIds.length;
}

export function prepareDirectorPlans(world: WorldState, season: number, riders: readonly Rider[]): void {
  const plannedTeamIds = new Set(
    world.directorPlans.filter((plan) => plan.season === season).map((plan) => plan.teamId),
  );
  for (const team of world.teams) {
    if (plannedTeamIds.has(team.id)) continue;
    const squad = riders.filter((rider) => rider.teamId === team.id);
    const division = world.teamSeasons[team.id].division;
    const targets = calendarForDivision(division)
      .map((raceId) => {
        const race = RACES_BY_ID.get(raceId)!;
        const leader = [...squad].sort((left, right) => riderRaceScore(right, race) - riderRaceScore(left, race))[0];
        const strength = leader ? riderRaceScore(leader, race) : 0;
        const tie = deriveSeed(world.seed, 'director-target', season, team.id, raceId) / 0xffffffff;
        return { race, leader, score: strength + tie };
      })
      .filter((entry) => entry.leader)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .sort((left, right) => calendarForDivision(division).indexOf(left.race.id) - calendarForDivision(division).indexOf(right.race.id))
      .map(({ race, leader }) => ({
        raceId: race.id,
        leaderId: leader!.id,
        reason: `${race.name} suits ${leader!.name}'s strengths`,
      }));
    world.directorPlans.push({
      season,
      teamId: team.id,
      targets,
      tacticalPreference: PREFERENCE_BY_PHILOSOPHY[team.philosophy],
    });
  }
}

export function directorPlanFor(world: WorldState, teamId: string, season: number): RivalDirectorPlan | undefined {
  return world.directorPlans.find((plan) => plan.season === season && plan.teamId === teamId);
}