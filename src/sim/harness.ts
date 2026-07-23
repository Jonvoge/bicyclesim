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

import { RACES, RACES_BY_ID } from '../data/races.ts';
import { RIDERS, RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { PLAYER_TEAM, TEAMS, TEAMS_BY_ID } from '../data/teams.ts';
import type { Stage, StageResult } from '../data/types.ts';
import { Rng } from './rng.ts';
import { simulateStage } from './stageSim.ts';
import { buildRaceStory } from './raceNarrative.ts';
import { bestSuitedRider, buildTacticsMap, defaultTeamTactics } from './raceSetup.ts';
import { computeGc, createTour, isTourComplete, recordStageResult, ridersForStage } from './standings.ts';
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
