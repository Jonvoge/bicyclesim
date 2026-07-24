/**
 * Headless sim harness (Phase 1) — NO Phaser.
 *
 * Run with:  npm run sim
 *
 * Prints finishing orders for each stage, shows that the right specialist wins
 * the right stage type, that results vary run-to-run, and that rider roles
 * visibly change outcomes. This is the "eyeball the maths before any UI" tool
 * (SPEC §5).
 */

import { RACES, RACES_BY_ID, SEASON_CALENDAR } from '../data/races.ts';
import { RIDERS, RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { PLAYER_TEAM, TEAMS, TEAMS_BY_ID } from '../data/teams.ts';
import type { Rider, Stage, StageResult } from '../data/types.ts';
import { Rng } from './rng.ts';
import { simulateStage } from './stageSim.ts';
import { buildRaceStory } from './raceNarrative.ts';
import { bestSuitedRider, buildTacticsMap, defaultTeamTactics, defaultTeamTacticsFor } from './raceSetup.ts';
import { riderRating, riderSalary, salaryFor, signingFeeFor } from './rating.ts';
import { scoutReport } from './development.ts';
import { sponsorIncome } from './management.ts';
import {
  createDynasty,
  finishSeasonEvent,
  freeAgents,
  playerBudget,
  playerRiders,
  playerWageBill,
  racingRoster,
  rolloverSeason,
  signRider,
  teamRiders,
  trainRider,
} from '../state/dynasty.ts';
import { computeGc, createTour, isTourComplete, recordStageResult, ridersForStage } from './standings.ts';
import {
  createSeason,
  finishEvent,
  isSeasonComplete,
  riderStandings,
  startEvent,
  teamStandings,
} from './season.ts';
import type { TacticRole, TeamEffort, TeamTactics } from './tactics.ts';

function teamName(riderId: string): string {
  const teamId = RIDERS_BY_ID.get(riderId)?.teamId;
  return (teamId && TEAMS_BY_ID.get(teamId)?.name) || '—';
}

function riderName(riderId: string): string {
  return RIDERS_BY_ID.get(riderId)?.name ?? riderId;
}

function fmtTime(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function fmtGap(sec: number): string {
  if (sec <= 0.5) return '—';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m > 0 ? `+${m}:${String(ss).padStart(2, '0')}` : `+${ss}s`;
}

/** The player's default role sheet for a stage (same default the UI pre-fills). */
function playerDefault(stage: Stage): TeamTactics {
  return defaultTeamTactics(PLAYER_TEAM, stage);
}

/** Player sheet with every rider on one role except a named leader setup. */
function playerSheet(roles: Record<string, TacticRole>): TeamTactics {
  const sheet: Record<string, TacticRole> = {};
  for (const id of PLAYER_TEAM.riderIds) sheet[id] = roles[id] ?? 'free';
  return { teamId: PLAYER_TEAM.id, roles: sheet };
}

function printResult(stage: Stage, result: StageResult, topN = 10): void {
  console.log(`\n=== ${stage.name}  [${stage.type}, ${stage.lengthKm}km] ===`);
  console.log('  #  rider                team                  perf    time      gap');
  const winnerTime = result.order[0]?.timeSec ?? 0;
  result.order.slice(0, topN).forEach((e, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)} ` +
        `${riderName(e.riderId).padEnd(20)} ` +
        `${teamName(e.riderId).padEnd(20)} ` +
        `${e.perfScore.toFixed(1).padStart(5)}  ` +
        `${fmtTime(e.timeSec)}  ${fmtGap(e.timeSec - winnerTime)}`,
    );
  });
}

// --- 1. One representative run per stage --------------------------------------
console.log('\n########## SINGLE RUN PER STAGE ##########');
for (const race of RACES) {
  const stage = STAGES_BY_ID.get(race.stageIds[0])!;
  const rng = new Rng(1234 + stage.name.length);
  const result = simulateStage({ stage, riders: RIDERS, tacticsByTeam: buildTacticsMap(stage, playerDefault(stage)), rng });
  printResult(stage, result);
}

// --- 2. Favourite-wins frequency over many runs -------------------------------
console.log('\n\n########## VARIABILITY (1000 runs / stage) ##########');
console.log('Does the favourite win most — but not always?\n');
for (const race of RACES) {
  const stage = STAGES_BY_ID.get(race.stageIds[0])!;
  const N = 1000;
  const wins = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    const rng = new Rng(i * 2654435761);
    const result = simulateStage({ stage, riders: RIDERS, tacticsByTeam: buildTacticsMap(stage, playerDefault(stage)), rng });
    const w = result.order[0].riderId;
    wins.set(w, (wins.get(w) ?? 0) + 1);
  }
  const ranked = [...wins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  console.log(`${stage.name} [${stage.type}]:`);
  for (const [id, n] of ranked) {
    console.log(`    ${((n / N) * 100).toFixed(1).padStart(5)}%  ${riderName(id)} (${teamName(id)})`);
  }
  console.log('');
}

// --- 3. Rider roles visibly change outcomes -----------------------------------
console.log('\n########## ROLES EFFECT ##########');
console.log("Player star's average finishing position on the summit finish,");
console.log('under different role sheets (500 runs, same seeds across sheets):\n');
{
  const stage = STAGES_BY_ID.get('st-lombardo')!;
  const star = bestSuitedRider(PLAYER_TEAM.riderIds, stage);
  const others = PLAYER_TEAM.riderIds.filter((id) => id !== star);
  const sheets: [string, TeamTactics][] = [
    ['leader + 5 domestiques', playerSheet({ [star]: 'leader', ...Object.fromEntries(others.map((id) => [id, 'domestique'])) })],
    ['leader, others free', playerSheet({ [star]: 'leader' })],
    ['star on breakaway', playerSheet({ [star]: 'breakaway' })],
    ['everyone free', playerSheet({})],
  ];
  for (const [label, sheet] of sheets) {
    const N = 500;
    let sumPos = 0;
    let winCount = 0;
    for (let i = 0; i < N; i++) {
      const rng = new Rng(i * 40503 + 7);
      const result = simulateStage({ stage, riders: RIDERS, tacticsByTeam: buildTacticsMap(stage, sheet), rng });
      const pos = result.order.findIndex((e) => e.riderId === star) + 1;
      sumPos += pos;
      if (pos === 1) winCount++;
    }
    console.log(
      `    ${label.padEnd(24)} avg finish ${(sumPos / N).toFixed(2).padStart(5)}   ` +
        `win rate ${((winCount / N) * 100).toFixed(1)}%   (${riderName(star)})`,
    );
  }
}
console.log('');

// --- 4. A full tour: GC, fatigue accrual, and the conserve lever --------------
console.log('\n########## STAGE RACE: GC + FATIGUE ##########');

/** Run one tour headlessly; player team can conserve on the named stage indices. */
function runTour(raceId: string, seed: number, conserveStages: Set<number> = new Set()) {
  const race = RACES_BY_ID.get(raceId)!;
  const tour = createTour(race);
  const rng = new Rng(seed);
  const fatigueSnapshots: Map<string, number>[] = []; // fatigue going INTO each stage
  while (!isTourComplete(tour)) {
    const idx = tour.stageIndex;
    const stage = STAGES_BY_ID.get(tour.stageIds[idx])!;
    fatigueSnapshots[idx] = new Map(tour.fatigue);
    const riders = ridersForStage(tour, RIDERS);
    const tactics = new Map<string, TeamTactics>();
    for (const team of TEAMS) {
      const effort: TeamEffort = team.isPlayer && conserveStages.has(idx) ? 'conserve' : 'race';
      tactics.set(team.id, { ...defaultTeamTactics(team, stage), effort });
    }
    const story = buildRaceStory({ stage, riders, tacticsByTeam: tactics, rng });
    recordStageResult(tour, stage, story.result, tactics, riders);
  }
  return { tour, fatigueSnapshots };
}

for (const raceId of ['r-provence', 'r-aurelia']) {
  const race = RACES_BY_ID.get(raceId)!;
  const { tour } = runTour(raceId, 2026);
  const gc = computeGc(tour);
  console.log(`\n=== ${race.name} — final GC (${tour.results.length} stages) ===`);
  console.log('  #  rider                team                  total       gap    fatigue');
  gc.slice(0, 8).forEach((row, i) => {
    const fat = tour.fatigue.get(row.riderId) ?? 0;
    console.log(
      `  ${String(i + 1).padStart(2)} ${riderName(row.riderId).padEnd(20)} ${teamName(row.riderId).padEnd(20)} ` +
        `${fmtTime(row.totalTimeSec)}  ${fmtGap(row.gapSec).padStart(6)}   ${fat.toFixed(1).padStart(5)}`,
    );
  });
  if (tour.abandoned.size > 0) console.log(`  (abandoned: ${[...tour.abandoned].map(riderName).join(', ')})`);
}

// The conserve lever: saving the leader on the non-GC stages (flat/cobbled/hilly,
// where a climber gains nothing) should leave him fresher — and faster — on the
// queen stage. Measured as his fatigue into the final summit finish and his gap
// to the stage winner there (same seeds across scenarios).
console.log('\n--- Conserve lever (Provence, 300 seeds, star = Tano Pogar) ---');
{
  const N = 300;
  const star = 'gr-pogar';
  const scenarios: [string, Set<number>][] = [
    ['race every stage', new Set()],
    ['conserve stages 1–3', new Set([0, 1, 2])],
  ];
  for (const [label, conserve] of scenarios) {
    let sumFatigue = 0;
    let sumQueenGap = 0;
    let sumGcGap = 0;
    for (let i = 0; i < N; i++) {
      const { tour, fatigueSnapshots } = runTour('r-provence', i * 2654435761, conserve);
      const finalIdx = tour.results.length - 1;
      sumFatigue += fatigueSnapshots[finalIdx]?.get(star) ?? 0;
      const queen = tour.results[finalIdx];
      const win = queen.order.find((e) => !e.dnf)!.timeSec;
      const mine = queen.order.find((e) => e.riderId === star);
      if (mine && !mine.dnf) sumQueenGap += mine.timeSec - win;
      const gc = computeGc(tour);
      const meIdx = gc.findIndex((g) => g.riderId === star);
      if (meIdx >= 0) sumGcGap += gc[meIdx].gapSec;
    }
    console.log(
      `    ${label.padEnd(20)} fatigue→queen ${(sumFatigue / N).toFixed(1).padStart(5)}   ` +
        `queen gap ${fmtGap(sumQueenGap / N).padStart(6)}   avg GC gap ${fmtGap(sumGcGap / N).padStart(6)}`,
    );
  }
}
console.log('');

// --- 5. A full season: points, standings, and who wins what -------------------
console.log('\n########## SEASON: CALENDAR, POINTS & STANDINGS ##########');
{
  const season = createSeason(SEASON_CALENDAR);
  const rng = new Rng(2026);
  const winners: string[] = [];
  while (!isSeasonComplete(season)) {
    const tour = startEvent(season, RIDERS);
    while (!isTourComplete(tour)) {
      const stage = STAGES_BY_ID.get(tour.stageIds[tour.stageIndex])!;
      const riders: Rider[] = ridersForStage(tour, RIDERS);
      const tactics = new Map(TEAMS.map((t) => [t.id, defaultTeamTactics(t, stage)]));
      const story = buildRaceStory({ stage, riders, tacticsByTeam: tactics, rng });
      recordStageResult(tour, stage, story.result, tactics, riders);
    }
    const race = RACES_BY_ID.get(tour.raceId)!;
    const res = finishEvent(season, tour, RIDERS);
    winners.push(`${race.name.padEnd(20)} → ${riderName(res.winnerId)}`);
  }
  console.log('\nRace winners:');
  for (const w of winners) console.log(`    ${w}`);

  console.log('\nRider season ranking (top 10):');
  riderStandings(season).slice(0, 10).forEach((row, i) => {
    console.log(`    ${String(i + 1).padStart(2)}  ${riderName(row.id).padEnd(20)} ${teamName(row.id).padEnd(20)} ${String(row.points).padStart(4)} pts`);
  });

  console.log('\nTeam season ranking:');
  teamStandings(season, (id) => RIDERS_BY_ID.get(id)?.teamId ?? null).forEach((row, i) => {
    console.log(`    ${i + 1}  ${(TEAMS_BY_ID.get(row.id)?.name ?? row.id).padEnd(22)} ${String(row.points).padStart(4)} pts`);
  });
}
console.log('');

// --- 6. Management layer: economy, transfers, training & rollover (Phase 5) ----
console.log('\n########## MANAGEMENT: ECONOMY, TRANSFERS & TRAINING ##########');
{
  const d = createDynasty();

  // valuation: what the squad and the market are worth
  console.log('\nPlayer squad valuation (rating → salary):');
  for (const r of playerRiders(d)) {
    console.log(`    ${r.name.padEnd(20)} rating ${String(riderRating(r)).padStart(3)}   salary ${String(riderSalary(r)).padStart(4)}`);
  }

  console.log(`\nOpening budget ${playerBudget(d)}   ·   wage bill ${playerWageBill(d)}   ·   sponsor@mid ${sponsorIncome(undefined, TEAMS.length)}`);

  console.log('\nFree-agent market (rating · salary · signing fee):');
  for (const r of freeAgents(d)) {
    const rt = riderRating(r);
    console.log(`    ${r.name.padEnd(20)} ${String(rt).padStart(3)}   ${String(salaryFor(rt)).padStart(4)}   fee ${String(signingFeeFor(rt)).padStart(4)}`);
  }

  // sign the top free agent, train a young rider
  const target = [...freeAgents(d)].sort((a, b) => riderRating(b) - riderRating(a))[0];
  const sign = signRider(d, target.id);
  console.log(`\nSign ${target.name}: ${sign.ok ? 'done' : sign.reason} → budget now ${playerBudget(d)}, squad ${playerRiders(d).length}`);

  const pupil = playerRiders(d).find((r) => r.stats.climbing < 80)!;
  const before = pupil.stats.climbing;
  const t = trainRider(d, pupil.id, 'climbing');
  console.log(`Train ${pupil.name} climbing: ${before} → ${pupil.stats.climbing} (+${t.gain?.toFixed(1)}), fatigue now ${(d.season.fatigue.get(pupil.id) ?? 0).toFixed(1)}`);

  // play the whole season with this squad, then roll into next year
  const rng = new Rng(77);
  let prize = 0;
  const startBudget = playerBudget(d);
  while (!isSeasonComplete(d.season)) {
    const field = racingRoster(d);
    const tour = startEvent(d.season, field);
    while (!isTourComplete(tour)) {
      const stage = STAGES_BY_ID.get(tour.stageIds[tour.stageIndex])!;
      const riders = ridersForStage(tour, field);
      const tactics = new Map(TEAMS.map((tm) => [tm.id, defaultTeamTacticsFor(tm.id, teamRiders(d, tm.id), stage)]));
      const story = buildRaceStory({ stage, riders, tacticsByTeam: tactics, rng });
      recordStageResult(tour, stage, story.result, tactics, riders);
    }
    finishSeasonEvent(d, tour);
  }
  prize = playerBudget(d) - startBudget;
  console.log(`\nSeason ${d.seasonNumber} raced — prize money earned by player: ${prize}`);

  const summary = rolloverSeason(d);
  console.log(
    `Rollover: finished rank ${summary.teamRank}/${TEAMS.length}  ·  sponsor ${summary.sponsor} − wages ${summary.wages} = ${summary.net >= 0 ? '+' : ''}${summary.net}`,
  );
  console.log(`  → season ${d.seasonNumber} budget ${playerBudget(d)}${summary.expiring.length ? `, renewed: ${summary.expiring.map(riderName).join(', ')}` : ''}`);
}
console.log('');

// --- 7. Rider development & dynasty: growth, decline, retirement (Phase 6) ------
console.log('\n########## DEVELOPMENT: CAREERS RISE, PLATEAU & FADE ##########');
{
  const d = createDynasty();
  const young = 'gr-vance'; // 21yo all-rounder — should grow
  const vet = 'so-rogla'; // 34yo veteran — should decline then retire
  const byId = () => new Map(d.roster.map((r) => [r.id, r]));

  const line = (id: string): string => {
    const r = byId().get(id);
    if (!r) return 'retired';
    const best = Math.max(r.stats.climbing, r.stats.flat, r.stats.sprint, r.stats.puncheur);
    return `age ${r.age} · rating ${riderRating(r)} · best ${Math.round(best)}`;
  };
  const peak = (id: string): number => byId().get(id)?.peakAge ?? 0;
  console.log(`\n${riderName(young)} (peak ${peak(young)}) and ${riderName(vet)} (peak ${peak(vet)}) over 8 seasons:`);
  console.log(`  S1  ${riderName(young).padEnd(16)} ${line(young)}    |  ${riderName(vet).padEnd(16)} ${line(vet)}`);
  for (let s = 1; s <= 8; s++) {
    const sum = rolloverSeason(d);
    console.log(
      `  S${s + 1}  ${riderName(young).padEnd(16)} ${line(young).padEnd(34)}  |  ${riderName(vet).padEnd(16)} ${line(vet).padEnd(34)}` +
        `  churn: ${sum.retiredAll} retired, ${sum.emerged} turned pro`,
    );
  }

  console.log('\nSome of this year’s prospects (scouted potential is FUZZY for the young):');
  freeAgents(d)
    .filter((r) => r.id.startsWith('fa-gen-'))
    .slice(0, 6)
    .forEach((r) => {
      const sc = scoutReport(r);
      console.log(
        `    ${r.name.padEnd(20)} age ${r.age} · now ${String(riderRating(r)).padStart(2)} · potential ${'★'.repeat(sc.stars)}${'·'.repeat(5 - sc.stars)} (${sc.label})`,
      );
    });
}
console.log('');
