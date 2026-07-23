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

import { RACES } from '../data/races.ts';
import { RIDERS, RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { PLAYER_TEAM, TEAMS_BY_ID } from '../data/teams.ts';
import type { Stage, StageResult } from '../data/types.ts';
import { Rng } from './rng.ts';
import { simulateStage } from './stageSim.ts';
import { bestSuitedRider, buildTacticsMap, defaultTeamTactics } from './raceSetup.ts';
import type { TacticRole, TeamTactics } from './tactics.ts';

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
