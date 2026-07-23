/**
 * Headless sim harness (Phase 1) — NO Phaser.
 *
 * Run with:  npm run sim
 *
 * Prints finishing orders for each stage, shows that the right specialist wins
 * the right stage type, that results vary run-to-run, and that tactics visibly
 * change outcomes. This is the "eyeball the maths before any UI" tool (SPEC §5).
 */

import { RACES } from '../data/races.ts';
import { RIDERS, RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { TEAMS, TEAMS_BY_ID } from '../data/teams.ts';
import type { Stage, StageResult } from '../data/types.ts';
import { Rng } from './rng.ts';
import { baseScore, simulateStage } from './stageSim.ts';
import type { Strategy, TeamTactics } from './tactics.ts';

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

/**
 * Rivals auto-race: each rival team protects its best-suited rider for the stage
 * and goes PROTECT_LEADER. (A placeholder; proper rival AI is Phase 4.)
 */
function rivalTactics(stage: Stage): TeamTactics[] {
  return TEAMS.filter((t) => !t.isPlayer).map((team) => {
    const best = team.riderIds
      .map((id) => RIDERS_BY_ID.get(id)!)
      .sort((a, b) => baseScore(b, stage) - baseScore(a, stage))[0];
    return { teamId: team.id, protectedRiderId: best.id, strategy: 'PROTECT_LEADER' as Strategy };
  });
}

function tacticsMap(stage: Stage, player: TeamTactics): Map<string, TeamTactics> {
  const map = new Map<string, TeamTactics>();
  map.set(player.teamId, player);
  for (const t of rivalTactics(stage)) map.set(t.teamId, t);
  return map;
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

/** Player protects their strongest rider for the stage. */
function playerProtected(stage: Stage): string {
  const playerTeam = TEAMS.find((t) => t.isPlayer)!;
  return playerTeam.riderIds
    .map((id) => RIDERS_BY_ID.get(id)!)
    .sort((a, b) => baseScore(b, stage) - baseScore(a, stage))[0].id;
}

// --- 1. One representative run per stage --------------------------------------
console.log('\n########## SINGLE RUN PER STAGE ##########');
for (const race of RACES) {
  const stage = STAGES_BY_ID.get(race.stageIds[0])!;
  const player: TeamTactics = {
    teamId: 't-grenoble',
    protectedRiderId: playerProtected(stage),
    strategy: 'PROTECT_LEADER',
  };
  const rng = new Rng(1234 + stage.name.length);
  const result = simulateStage({ stage, riders: RIDERS, tacticsByTeam: tacticsMap(stage, player), rng });
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
    const player: TeamTactics = {
      teamId: 't-grenoble',
      protectedRiderId: playerProtected(stage),
      strategy: 'PROTECT_LEADER',
    };
    const rng = new Rng(i * 2654435761);
    const result = simulateStage({ stage, riders: RIDERS, tacticsByTeam: tacticsMap(stage, player), rng });
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

// --- 3. Tactics visibly change outcomes ---------------------------------------
console.log('\n########## TACTICS EFFECT ##########');
console.log("Player star's average finishing position on the summit finish,");
console.log('under each strategy (500 runs, same seeds across strategies):\n');
{
  const stage = STAGES_BY_ID.get('st-lombardo')!;
  const star = playerProtected(stage);
  const strategies: Strategy[] = ['PROTECT_LEADER', 'BREAKAWAY', 'SPRINT_FINISH', 'CONSERVE'];
  for (const strategy of strategies) {
    const N = 500;
    let sumPos = 0;
    let winCount = 0;
    for (let i = 0; i < N; i++) {
      const player: TeamTactics = { teamId: 't-grenoble', protectedRiderId: star, strategy };
      const rng = new Rng(i * 40503 + 7);
      const result = simulateStage({ stage, riders: RIDERS, tacticsByTeam: tacticsMap(stage, player), rng });
      const pos = result.order.findIndex((e) => e.riderId === star) + 1;
      sumPos += pos;
      if (pos === 1) winCount++;
    }
    console.log(
      `    ${strategy.padEnd(14)} avg finish ${(sumPos / N).toFixed(2).padStart(5)}   ` +
        `win rate ${((winCount / N) * 100).toFixed(1)}%   (${riderName(star)})`,
    );
  }
}
console.log('');
