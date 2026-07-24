/**
 * Balance-health report (Phase 8). Simulates full multi-season dynasties headlessly
 * and prints the metrics that decide whether the guessed `tuning.ts` numbers are in
 * a sane range: race-winner spread, season competitiveness, the economy trajectory,
 * peloton quality as generations turn over, and squad viability.
 *
 * Run: npx tsx scripts/balanceReport.ts   (analysis only — not part of the build/tests)
 */
import { RACES_BY_ID, SEASON_CALENDAR } from '../src/data/races.ts';
import { RIDERS_BY_ID } from '../src/data/riders.ts';
import { STAGES_BY_ID } from '../src/data/stages.ts';
import { TEAMS, TEAMS_BY_ID, PLAYER_TEAM } from '../src/data/teams.ts';
import { buildRaceStory } from '../src/sim/raceNarrative.ts';
import { defaultTeamTacticsFor } from '../src/sim/raceSetup.ts';
import { riderRating } from '../src/sim/rating.ts';
import { Rng } from '../src/sim/rng.ts';
import { isSeasonComplete, riderStandings, startEvent, teamStandings } from '../src/sim/season.ts';
import { isTourComplete, recordStageResult, ridersForStage } from '../src/sim/standings.ts';
import {
  createDynasty,
  finishSeasonEvent,
  playerBudget,
  racingRoster,
  rolloverSeason,
  teamOf,
  teamRiders,
  type DynastyState,
} from '../src/state/dynasty.ts';

function playSeason(d: DynastyState, rng: Rng): void {
  while (!isSeasonComplete(d.season)) {
    const field = racingRoster(d);
    const tour = startEvent(d.season, field);
    while (!isTourComplete(tour)) {
      const stage = STAGES_BY_ID.get(tour.stageIds[tour.stageIndex])!;
      const riders = ridersForStage(tour, field);
      const tactics = new Map(TEAMS.map((t) => [t.id, defaultTeamTacticsFor(t.id, teamRiders(d, t.id), stage)]));
      const story = buildRaceStory({ stage, riders, tacticsByTeam: tactics, rng });
      recordStageResult(tour, stage, story.result, tactics, riders);
    }
    finishSeasonEvent(d, tour);
  }
}

const SEASONS = 10;
const RUNS = 5;

// aggregate across runs
const budgetBySeason: number[][] = [];
const retiredBySeason: number[][] = [];
const avgTopRatingBySeason: number[][] = [];
const playerRankBySeason: number[][] = [];
const distinctWinnersPerSeason: number[] = [];
let minSquadEver = 99;

for (let run = 0; run < RUNS; run++) {
  const d = createDynasty();
  const rng = new Rng(1000 + run * 7919);
  for (let s = 0; s < SEASONS; s++) {
    playSeason(d, rng);
    // distinct race winners this season
    const winners = new Set(d.season.results.map((r) => r.winnerId));
    distinctWinnersPerSeason.push(winners.size);
    // player rank
    const tStand = teamStandings(d.season, (id) => teamOf(d, id));
    const prank = tStand.findIndex((t) => t.id === PLAYER_TEAM.id) + 1;
    (playerRankBySeason[s] ??= []).push(prank || TEAMS.length);
    // squad sizes
    for (const t of TEAMS) minSquadEver = Math.min(minSquadEver, teamRiders(d, t.id).length);
    // peloton quality: mean of each team's best rider rating
    const tops = TEAMS.map((t) => Math.max(...teamRiders(d, t.id).map((r) => riderRating(r))));
    (avgTopRatingBySeason[s] ??= []).push(tops.reduce((a, b) => a + b, 0) / tops.length);

    (budgetBySeason[s] ??= []).push(playerBudget(d));
    const sum = rolloverSeason(d);
    (retiredBySeason[s] ??= []).push(sum.retiredAll);
  }
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const fmt = (n: number, w = 6): string => n.toFixed(1).padStart(w);

console.log(`\n=== BALANCE HEALTH (${RUNS} dynasties × ${SEASONS} seasons) ===\n`);
console.log('Season |  player$ |  rank |  retired |  avgTopRating');
for (let s = 0; s < SEASONS; s++) {
  console.log(
    `  ${String(s + 1).padStart(4)} | ${fmt(mean(budgetBySeason[s]), 8)} | ${fmt(mean(playerRankBySeason[s]), 5)} | ${fmt(mean(retiredBySeason[s]), 8)} | ${fmt(mean(avgTopRatingBySeason[s]), 8)}`,
  );
}
console.log(`\nDistinct race winners / season (of ${SEASON_CALENDAR.length} races): mean ${mean(distinctWinnersPerSeason).toFixed(1)}`);
console.log(`Smallest squad any team ever had: ${minSquadEver}`);

// season-1 race winners by terrain (one run) — is the winner pool broad?
{
  const d = createDynasty();
  const rng = new Rng(2027);
  playSeason(d, rng);
  console.log('\nSeason-1 race winners (one run):');
  for (const res of d.season.results) {
    const race = RACES_BY_ID.get(res.raceId)!;
    const w = RIDERS_BY_ID.get(res.winnerId);
    const name = w?.name ?? res.winnerId;
    const team = w ? TEAMS_BY_ID.get(w.teamId!)?.name : '—';
    console.log(`   ${race.name.padEnd(20)} ${name.padEnd(20)} ${team}`);
  }
  const champ = riderStandings(d.season)[0];
  console.log(`   → season champion: ${RIDERS_BY_ID.get(champ.id)?.name} (${champ.points} pts)`);
}
console.log('');
