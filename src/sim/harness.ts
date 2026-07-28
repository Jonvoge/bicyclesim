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

import { conditionForEvent, FOCUS_PLANS, planArea } from '../data/focusPlans.ts';
import { RACES, RACES_BY_ID, SEASON_CALENDAR } from '../data/races.ts';
import { RIDERS, RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { PLAYER_TEAM, TEAMS, TEAMS_BY_ID } from '../data/teams.ts';
import type { Rider, Stage, StageResult } from '../data/types.ts';
import { Rng } from './rng.ts';
import { simulateStage } from './stageSim.ts';
import { buildRaceStory } from './raceNarrative.ts';
import { legReadFace, legReadLabel } from './legRead.ts';
import { bestSuitedRider, buildTacticsMap, defaultTeamTactics, defaultTeamTacticsFor } from './raceSetup.ts';
import { riderRating, riderSalary, salaryFor, signingFeeFor } from './rating.ts';
import { DEV_STATS, scoutReport } from './development.ts';
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
    ['star free/attack', playerSheet({ [star]: 'free' })],
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
function runTour(raceId: string, seed: number, conserveStages: Set<number> = new Set(), conserveTeamId = PLAYER_TEAM.id) {
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
      const effort: TeamEffort = team.id === conserveTeamId && conserveStages.has(idx) ? 'conserve' : 'race';
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

// Matched-seed counterfactuals across every current tour. Selective Conserve uses
// low-selectiveness stages before harder GC days; Conserve-all must pay for giving
// up stage ambition on every route type.
console.log('\n--- Conserve counterfactuals (200 matched seeds per tour/rider) ---');
for (const raceId of ['r-provence', 'r-aurelia', 'r-iberia']) {
  const race = RACES_BY_ID.get(raceId)!;
  const selective = new Set(
    race.stageIds
      .map((stageId, index) => ({ stage: STAGES_BY_ID.get(stageId)!, index }))
      .filter(({ stage }) => stage.type === 'flat' || stage.type === 'cobbled' || stage.type === 'descentFinish')
      .map(({ index }) => index),
  );
  const all = new Set(race.stageIds.map((_, index) => index));
  for (const star of ['gr-pogar', 'vm-vinge']) {
    const teamId = RIDERS_BY_ID.get(star)!.teamId!;
    console.log(`\n  ${race.name} · ${riderName(star)} · selective stages ${[...selective].map((i) => i + 1).join(', ') || 'none'}`);
    for (const [label, conserve] of [
      ['Race all', new Set<number>()],
      ['Selective', selective],
      ['Conserve all', all],
    ] as [string, Set<number>][]) {
      let wins = 0;
      let finishes = 0;
      let positionTotal = 0;
      for (let seed = 0; seed < 200; seed++) {
        const { tour } = runTour(raceId, seed * 2654435761 + 31, conserve, teamId);
        const gc = computeGc(tour);
        const position = gc.findIndex((row) => row.riderId === star);
        if (position < 0) continue;
        finishes++;
        positionTotal += position + 1;
        if (position === 0) wins++;
      }
      console.log(
        `    ${label.padEnd(14)} win ${((wins / Math.max(1, finishes)) * 100).toFixed(1).padStart(5)}%   avg GC ${(positionTotal / Math.max(1, finishes)).toFixed(2)}`,
      );
    }
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

  // auto-training: pick the youngest player rider and watch the season's camps develop them
  const pupil = [...playerRiders(d)].sort((a, b) => a.age - b.age)[0];
  const pupilBefore = { ...pupil.stats };

  // play the whole season with this squad, then roll into next year
  const rng = new Rng(77);
  let prize = 0;
  let camps = 0;
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
    if (d.lastTraining) camps++;
  }
  prize = playerBudget(d) - startBudget;
  console.log(`\nSeason ${d.seasonNumber} raced — prize money earned by player: ${prize}`);

  const grew = DEV_STATS.map((k) => `${k} ${pupilBefore[k]}→${pupil.stats[k]}`).filter((_, i) => pupil.stats[DEV_STATS[i]] > pupilBefore[DEV_STATS[i]]);
  console.log(`Auto-training: ${camps} camps ran. ${pupil.name} (age ${pupil.age}) developed: ${grew.length ? grew.join(', ') : 'no change (near ceiling)'}`);

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

// --- 8. Season Focus: condition curves + does a peak pay off? (Season Focus ext) --
console.log('\n########## SEASON FOCUS: CONDITION CURVES ##########');
{
  const N = SEASON_CALENDAR.length;
  // a compact sparkline of condition (0..1) across the season, per plan
  const bars = ' ▁▂▃▄▅▆▇█';
  const spark = (planId: string): string => {
    let s = '';
    for (let e = 0; e < N; e++) {
      const c = conditionForEvent(planId, e, N);
      s += bars[Math.max(0, Math.min(8, Math.round(c * 8)))];
    }
    return s;
  };
  console.log(`\nCondition across the ${N}-event calendar (each cell = one event), and the conserved form budget:\n`);
  for (const plan of FOCUS_PLANS) {
    console.log(`    ${plan.label.padEnd(16)} ${spark(plan.id)}   area ${planArea(plan).toFixed(3)}`);
  }

  // Does the peak actually pay? Run the queen summit finish with a star climber on
  // a GRAND TOUR plan, timed to his peak event vs an off (spring) event — same
  // seeds — and measure his average finishing position.
  console.log('\nDoes peaking pay? Star climber on the summit finish, 400 seeds (same across scenarios):');
  const stage = STAGES_BY_ID.get('st-lombardo')!;
  const star = 'gr-pogar';
  const scenarios: [string, number][] = [
    ['peak window (grandTour, mid-season)', conditionForEvent('grandTour', Math.round(N * 0.68), N)],
    ['off window   (grandTour, early spring)', conditionForEvent('grandTour', 1, N)],
  ];
  for (const [label, cond] of scenarios) {
    const runs = 400;
    let sumPos = 0;
    let wins = 0;
    for (let i = 0; i < runs; i++) {
      const rng = new Rng(i * 2654435761 + 5);
      const riders = RIDERS.map((r) => (r.id === star ? { ...r, condition: cond } : { ...r }));
      const result = simulateStage({ stage, riders, tacticsByTeam: buildTacticsMap(stage, playerDefault(stage)), rng });
      const pos = result.order.findIndex((e) => e.riderId === star) + 1;
      sumPos += pos;
      if (pos === 1) wins++;
    }
    console.log(`    ${label.padEnd(40)} condition ${cond.toFixed(2)}  avg finish ${(sumPos / runs).toFixed(2).padStart(5)}  win ${((wins / runs) * 100).toFixed(1)}%`);
  }
}
console.log('');

// --- 9. Daily form reveal: "read the legs" at the gun (Season Focus ext, Part B) --
console.log('\n########## READ THE LEGS ##########');
{
  const stageId = 'st-flandts';
  const stage = STAGES_BY_ID.get(stageId)!;
  const tactics = new Map(TEAMS.map((t) => [t.id, defaultTeamTactics(t, stage)]));
  const story = buildRaceStory({ stage, riders: RIDERS, tacticsByTeam: tactics, rng: new Rng(2026), playerTeamId: PLAYER_TEAM.id });
  console.log(`\nYour squad's legs at the gun (${stage.name}), z = form swing in units of the rider's own σ:\n`);
  for (const id of PLAYER_TEAM.riderIds) {
    const info = story.legReads.get(id);
    if (!info) continue;
    console.log(`    ${legReadFace(info.read)}  ${riderName(id).padEnd(20)} ${legReadLabel(info.read).padEnd(11)} (z ${info.z >= 0 ? '+' : ''}${info.z.toFixed(2)})`);
  }
  const legs = story.events.filter((e) => e.kind === 'legs');
  console.log(`\n  Race radio (legs): ${legs.length ? legs.map((e) => e.text).join(' · ') : '(a quiet day — nobody flying or flat)'}`);

  // distribution check over many seeds: FLYING/off should be rare, normal common
  const N = 4000;
  const counts: Record<string, number> = { flying: 0, good: 0, normal: 0, heavy: 0, off: 0 };
  const star = PLAYER_TEAM.riderIds[0];
  for (let i = 0; i < N; i++) {
    const s = buildRaceStory({ stage, riders: RIDERS, tacticsByTeam: tactics, rng: new Rng(i * 2654435761 + 9), playerTeamId: PLAYER_TEAM.id });
    counts[s.legReads.get(star)!.read]++;
  }
  console.log(`\n  ${riderName(star)}'s leg-read over ${N} days: ` + Object.entries(counts).map(([k, n]) => `${k} ${((n / N) * 100).toFixed(1)}%`).join(' · '));
}
console.log('');
