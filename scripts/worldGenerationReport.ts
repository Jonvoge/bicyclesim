import { riderRating, riderSalary } from '../src/sim/rating.ts';
import { validateWorld } from '../src/sim/worldBalance.ts';
import { generateWorldDraft } from '../src/sim/worldGeneration.ts';

const SAMPLE_SIZE = 1000;
const ratings = { world: [] as number[], pro: [] as number[], unsigned: [] as number[] };
const ages: number[] = [];
const salaries: number[] = [];
const proposalTotals: number[] = [];
let invalidWorlds = 0;
let rejectedProposalAttempts = 0;

for (let seed = 1; seed <= SAMPLE_SIZE; seed++) {
  const draft = generateWorldDraft({ seed });
  const validation = validateWorld(draft);
  if (!validation.valid) {
    invalidWorlds++;
    console.error(`Seed ${seed}: ${validation.errors.join('; ')}`);
  }
  rejectedProposalAttempts += draft.diagnostics.proposalAttempts.reduce((sum, attempts) => sum + attempts - 1, 0);
  const divisions = new Map(draft.world.teams.map((team) => [team.id, draft.world.teamSeasons[team.id].division]));
  for (const rider of draft.riders) {
    const division = rider.teamId ? divisions.get(rider.teamId) : undefined;
    const bucket = division === 'world' ? ratings.world : division === 'pro' ? ratings.pro : ratings.unsigned;
    bucket.push(riderRating(rider));
    ages.push(rider.age);
    salaries.push(riderSalary(rider));
  }
  proposalTotals.push(...draft.proposals.map((proposal) => proposal.totalRating));
}

function summary(values: number[]): string {
  const sorted = [...values].sort((left, right) => left - right);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const percentile = (fraction: number): number => sorted[Math.floor((sorted.length - 1) * fraction)];
  return `min ${sorted[0]} | mean ${mean.toFixed(1)} | p95 ${percentile(0.95)} | max ${sorted.at(-1)}`;
}

console.log(`\n=== GENERATED WORLD HEALTH (${SAMPLE_SIZE} seeds) ===\n`);
console.log(`Invalid worlds: ${invalidWorlds}`);
console.log(`Rejected proposal attempts: ${rejectedProposalAttempts} / ${SAMPLE_SIZE * 3} accepted proposals`);
console.log(`Top-division rider ratings: ${summary(ratings.world)}`);
console.log(`Lower-division rider ratings: ${summary(ratings.pro)}`);
console.log(`Unsigned/proposal rider ratings: ${summary(ratings.unsigned)}`);
console.log(`All rider ages: ${summary(ages)}`);
console.log(`All rider salaries: ${summary(salaries)}`);
console.log(`Proposal total ratings: ${summary(proposalTotals)}\n`);

if (invalidWorlds > 0) process.exitCode = 1;