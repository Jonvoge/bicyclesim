import { MAX_SQUAD_SIZE } from '../src/data/tuning.ts';
import { riderRating, signingFeeFor } from '../src/sim/rating.ts';
import { acceptSquadProposal, generateWorldDraft } from '../src/sim/worldGeneration.ts';
import {
  createGeneratedDynasty,
  freeAgents,
  playerBudget,
  playerRiders,
  releaseRider,
  rolloverSeason,
  signRider,
  teamRiders,
  type DynastyState,
} from '../src/state/dynasty.ts';

const RUNS = Number(process.env.RUNS ?? 1000);
const SEASONS = Number(process.env.SEASONS ?? 10);
const promotionSeasonCounts = new Map<number | 'none', number>();
const championCounts = new Map<string, number>();
const worldRatings: number[][] = [];
const proRatings: number[][] = [];
const playerBudgets: number[][] = [];
const retirements: number[][] = [];
let promotedCohorts = 0;
let survivedCohorts = 0;
let minSquad = Number.POSITIVE_INFINITY;
let automatedSignings = 0;

const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

function applyAutomatedPlayerPolicy(dynasty: DynastyState): boolean {
  const squad = playerRiders(dynasty).sort((left, right) => riderRating(left) - riderRating(right));
  const weakest = squad[0];
  const candidate = freeAgents(dynasty)
    .filter((rider) => signingFeeFor(riderRating(rider)) <= playerBudget(dynasty))
    .sort((left, right) => riderRating(right) - riderRating(left))[0];
  if (!weakest || !candidate || riderRating(candidate) < riderRating(weakest) + 3) return false;
  if (squad.length >= MAX_SQUAD_SIZE && !releaseRider(dynasty, weakest.id).ok) return false;
  return signRider(dynasty, candidate.id).ok;
}

for (let run = 0; run < RUNS; run++) {
  const draft = generateWorldDraft({ seed: 100_000 + run });
  const dynasty = createGeneratedDynasty(acceptSquadProposal(draft, draft.proposals[run % draft.proposals.length].id));
  let firstPromotion: number | undefined;
  let previousPromoted = new Set<string>();
  for (let season = 1; season <= SEASONS; season++) {
    if (season > 1 && applyAutomatedPlayerPolicy(dynasty)) automatedSignings++;
    const world = dynasty.world!;
    for (const division of ['world', 'pro'] as const) {
      const ratings = world.teams
        .filter((team) => world.teamSeasons[team.id].division === division)
        .flatMap((team) => teamRiders(dynasty, team.id).map(riderRating));
      (division === 'world' ? worldRatings : proRatings)[season - 1] ??= [];
      (division === 'world' ? worldRatings : proRatings)[season - 1].push(mean(ratings));
    }
    const summary = rolloverSeason(dynasty);
    (playerBudgets[season - 1] ??= []).push(playerBudget(dynasty));
    (retirements[season - 1] ??= []).push(summary.retiredAll);
    for (const team of dynasty.world!.teams) minSquad = Math.min(minSquad, teamRiders(dynasty, team.id).length);

    if (previousPromoted.size > 0) {
      promotedCohorts += previousPromoted.size;
      survivedCohorts += [...previousPromoted].filter((teamId) => !summary.movement!.relegatedTeamIds.includes(teamId)).length;
    }
    previousPromoted = new Set(summary.movement!.promotedTeamIds);
    if (summary.movement!.promotedTeamIds.includes(dynasty.playerTeamId) && firstPromotion === undefined) {
      firstPromotion = season;
    }
    for (const champion of dynasty.world!.history.teamChampions.filter((entry) => entry.season === season)) {
      const key = `${champion.division}:${champion.teamId}`;
      championCounts.set(key, (championCounts.get(key) ?? 0) + 1);
    }
  }
  const key = firstPromotion ?? 'none';
  promotionSeasonCounts.set(key, (promotionSeasonCounts.get(key) ?? 0) + 1);
}

console.log(`\n=== TWO-DIVISION HEALTH (${RUNS} dynasties x ${SEASONS} seasons) ===\n`);
console.log('First player promotion:');
for (let season = 1; season <= SEASONS; season++) {
  const count = promotionSeasonCounts.get(season) ?? 0;
  console.log(`  Season ${season}: ${count} (${((count / RUNS) * 100).toFixed(1)}%)`);
}
const never = promotionSeasonCounts.get('none') ?? 0;
console.log(`  Not promoted: ${never} (${((never / RUNS) * 100).toFixed(1)}%)`);
console.log(`Newly promoted one-season survival: ${((survivedCohorts / Math.max(1, promotedCohorts)) * 100).toFixed(1)}% (${survivedCohorts}/${promotedCohorts})`);

console.log('\nSeason | World rating | Pro rating | Player budget | Retirements');
for (let season = 0; season < SEASONS; season++) {
  console.log(
    `${String(season + 1).padStart(6)} | ${mean(worldRatings[season]).toFixed(1).padStart(12)} | ${mean(proRatings[season]).toFixed(1).padStart(10)} | ${mean(playerBudgets[season]).toFixed(0).padStart(13)} | ${mean(retirements[season]).toFixed(1).padStart(11)}`,
  );
}

const repeatChampions = [...championCounts.values()].filter((titles) => titles >= 3).length;
const mostTitles = Math.max(...championCounts.values());
console.log(`\nChampion turnover: ${championCounts.size} team/division winners; ${repeatChampions} won 3+ titles; maximum ${mostTitles}`);
console.log(`Smallest squad observed: ${minSquad}`);
console.log(`Automated player-policy signings: ${automatedSignings}`);