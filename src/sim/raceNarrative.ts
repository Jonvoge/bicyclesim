import { RIDERS_BY_ID } from '../data/riders.ts';
import { TEAMS_BY_ID } from '../data/teams.ts';
import {
  BREAK_FRIENDLINESS,
  BREAK_MAX_LEAD_SEC_MAX,
  BREAK_MAX_LEAD_SEC_MIN,
  BREAK_MAX_SIZE,
  BREAK_MIN_SIZE,
  BREAK_PEAK_T_MAX,
  BREAK_PEAK_T_MIN,
  BREAK_SURVIVE_BASE,
  BREAK_SURVIVE_MAX,
  BREAK_SURVIVE_TACTIC_BONUS,
  BREAK_SURVIVE_TACTIC_CAP,
  BREAK_SURVIVE_TERRAIN_W,
  BREAK_WIN_MARGIN_SEC,
  CATCH_T_MAX,
  CATCH_T_MIN,
  CRASH_DNF_FRACTION,
  FAVOURITE_COUNT,
  FINALE_T_MAX,
  FINALE_T_MIN,
  GROUP_GAP_THRESHOLD_HARD_SEC,
  GROUP_GAP_THRESHOLD_SEC,
  INCIDENT_PROB,
  INCIDENT_PROB_MULTIPLIER_RISKY,
  INCIDENT_TIME_LOSS_MAX,
  INCIDENT_TIME_LOSS_MIN,
  LATE_ATTACK_MARGIN_MAX,
  LATE_ATTACK_MARGIN_MIN,
  LATE_ATTACK_OCCUR_BASE,
  LATE_ATTACK_OCCUR_TERRAIN_W,
  LATE_ATTACK_SUCCESS_BASE,
  LATE_ATTACK_SUCCESS_MAX,
  LATE_ATTACK_SUCCESS_STRENGTH_W,
  LATE_ATTACK_SUCCESS_TACTIC_BONUS,
  LATE_ATTACK_SUCCESS_TERRAIN_W,
  PUNCTURE_SHARE,
  TERRAIN_SELECTIVENESS,
} from '../data/tuning.ts';
import type { StageResult, StageResultEntry, StageType } from '../data/types.ts';
import { perfToResult, scoreRiders, type StageSimInput } from './stageSim.ts';

/**
 * Race narrative layer (SPEC §5.9). A road race has TWO kinds of move, not one:
 *   - the MORNING BREAK — opportunists (never favourites) up the road early; it
 *     lives or dies mostly on how break-friendly the course is.
 *   - LATE ATTACKS — a favourite jumping clear in the finale; wins on climbs,
 *     gets chased down on flat roads.
 * The strongest riders save it and attack late, so the same day can end as a
 * surviving break, a favourite soloing, a shattered group, or a bunch sprint.
 * Everything is seeded → reproducible; only bounded, tunable outcome nudges.
 */

export type RiderRole = 'break' | 'attacker' | 'peloton' | 'contender' | 'dropped';
export type RaceShape = 'breakWins' | 'soloAttack' | 'selective' | 'sprint' | 'mixed';

export interface GapKey {
  t: number;
  gap: number; // seconds behind the head of the race
}

export interface Incident {
  t: number;
  type: 'crash' | 'puncture';
  dnf: boolean;
}

export interface RiderStory {
  riderId: string;
  role: RiderRole;
  inBreak: boolean;
  gaps: GapKey[];
  incident?: Incident;
}

export type RaceEventKind = 'break' | 'crash' | 'puncture' | 'catch' | 'attack' | 'finale' | 'info' | 'finish';

export interface RaceEvent {
  t: number;
  kind: RaceEventKind;
  text: string;
}

export interface FinishGroup {
  ids: string[];
  timeSec: number;
  gapSec: number;
}

export interface RaceStory {
  result: StageResult;
  groups: FinishGroup[];
  stories: Map<string, RiderStory>;
  events: RaceEvent[];
  breakIds: string[];
  breakSurvived: boolean;
  attackerId: string | null;
  finaleT: number;
  shape: RaceShape;
}

const T_BREAK_GO = 0.06;
const RISKY_TYPES = new Set(['cobbled', 'descentFinish']);

export function interpGap(gaps: GapKey[], t: number): number {
  if (t <= gaps[0].t) return gaps[0].gap;
  const last = gaps[gaps.length - 1];
  if (t >= last.t) return last.gap;
  for (let i = 1; i < gaps.length; i++) {
    if (t <= gaps[i].t) {
      const a = gaps[i - 1];
      const b = gaps[i];
      const f = (t - a.t) / (b.t - a.t || 1);
      return a.gap + (b.gap - a.gap) * f;
    }
  }
  return last.gap;
}

function lastName(riderId: string): string {
  return (RIDERS_BY_ID.get(riderId)?.name ?? riderId).split(' ').slice(-1)[0];
}

function fmtLead(sec: number): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m > 0 ? `${m}:${String(ss).padStart(2, '0')}` : `${ss}s`;
}

function groupThreshold(type: StageType): number {
  if (type === 'mountain' || type === 'summitFinish') return GROUP_GAP_THRESHOLD_HARD_SEC;
  return GROUP_GAP_THRESHOLD_SEC;
}

function idJitter(id: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 500 - 1;
}

export function buildRaceStory(input: StageSimInput): RaceStory {
  const { stage, rng } = input;
  const scored = scoreRiders(input);
  const events: RaceEvent[] = [];
  const friendliness = BREAK_FRIENDLINESS[stage.type] ?? 0.3;
  const selectiveness = TERRAIN_SELECTIVENESS[stage.type] ?? 0.4;

  const byPerfDesc = [...scored].sort((a, b) => b.perfScore - a.perfScore);
  const favourites = new Set(byPerfDesc.slice(0, FAVOURITE_COUNT).map((s) => s.riderId));
  // riders given the BREAKAWAY role: non-favourites join the morning break,
  // favourites are saved for a committed late attack instead (§5.9)
  const committed = new Set<string>();
  // riders with a job for the day (leader/sprinter/domestique) don't ride into the
  // morning break — respect the player's role sheet so a domestique isn't randomly
  // swept up the road. Rivals have no real tactics yet (Phase 4), so they stay a
  // free opportunist pool.
  const spokenFor = new Set<string>();
  for (const [teamId, t] of input.tacticsByTeam) {
    const isPlayerTeam = TEAMS_BY_ID.get(teamId)?.isPlayer ?? false;
    for (const [riderId, role] of Object.entries(t.roles)) {
      if (role === 'breakaway') committed.add(riderId);
      else if (isPlayerTeam && (role === 'leader' || role === 'sprinter' || role === 'domestique')) spokenFor.add(riderId);
    }
  }

  // --- morning break: opportunists ONLY (favourites save it for later) --------
  const size = BREAK_MIN_SIZE + rng.int(BREAK_MAX_SIZE - BREAK_MIN_SIZE + 1);
  const opportunistPool = byPerfDesc.map((s) => s.riderId).filter((id) => !favourites.has(id) && !spokenFor.has(id));
  const committedOpportunists = [...committed].filter((id) => !favourites.has(id));
  const shuffled = opportunistPool.filter((id) => !committedOpportunists.includes(id));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // every committed rider goes (even past the usual size), then fill with randoms
  const breakIds = committedOpportunists.slice(0, BREAK_MAX_SIZE);
  for (const id of shuffled) {
    if (breakIds.length >= size) break;
    breakIds.push(id);
  }
  const breakSet = new Set(breakIds);

  // --- incidents: punctures never abandon; crashes rarely (SPEC §5.6) ---------
  const timePenalties = new Map<string, number>();
  const dnfIds = new Set<string>();
  const incidents = new Map<string, Incident>();
  const riskyMult = RISKY_TYPES.has(stage.type) ? INCIDENT_PROB_MULTIPLIER_RISKY : 1;
  for (const s of scored) {
    if (rng.next() < INCIDENT_PROB * riskyMult) {
      const puncture = rng.next() < PUNCTURE_SHARE;
      const dnf = !puncture && rng.next() < CRASH_DNF_FRACTION;
      const loss = INCIDENT_TIME_LOSS_MIN + rng.next() * (INCIDENT_TIME_LOSS_MAX - INCIDENT_TIME_LOSS_MIN);
      const inc: Incident = { t: 0.2 + rng.next() * 0.6, type: puncture ? 'puncture' : 'crash', dnf };
      timePenalties.set(s.riderId, loss);
      if (dnf) dnfIds.add(s.riderId);
      incidents.set(s.riderId, inc);
      events.push({
        t: inc.t,
        kind: inc.type,
        text: `${puncture ? 'Puncture!' : 'Crash!'} ${lastName(s.riderId)}${dnf ? ' — abandons' : ''}`,
      });
    }
  }

  // --- does the morning break survive? ---------------------------------------
  const committedInBreak = breakIds.filter((id) => committed.has(id)).length;
  const breakSurviveChance = Math.min(
    BREAK_SURVIVE_MAX,
    BREAK_SURVIVE_BASE +
      BREAK_SURVIVE_TERRAIN_W * friendliness +
      Math.min(BREAK_SURVIVE_TACTIC_CAP, BREAK_SURVIVE_TACTIC_BONUS * committedInBreak),
  );
  let breakSurvived = false;
  let breakWinnerId: string | null = null;
  if (breakIds.length > 0 && rng.next() < breakSurviveChance) {
    const alive = byPerfDesc.filter((s) => breakSet.has(s.riderId) && !dnfIds.has(s.riderId));
    if (alive.length > 0) {
      breakSurvived = true;
      breakWinnerId = alive[0].riderId;
    }
  }

  // --- late attack by a favourite (only matters if the break is coming back) --
  let attackerId: string | null = null;
  let attackSucceeds = false;
  if (!breakSurvived) {
    // a favourite with the BREAKAWAY role is a committed late attacker
    const committedFav = byPerfDesc.find((s) => committed.has(s.riderId) && favourites.has(s.riderId) && !dnfIds.has(s.riderId));
    const attackOccurs = committedFav
      ? true
      : rng.next() < Math.min(1, LATE_ATTACK_OCCUR_BASE + selectiveness * LATE_ATTACK_OCCUR_TERRAIN_W);
    if (attackOccurs) {
      const candidate =
        committedFav ??
        byPerfDesc.slice(0, 3).filter((s) => !dnfIds.has(s.riderId) && !breakSet.has(s.riderId))[rng.int(Math.max(1, Math.min(3, FAVOURITE_COUNT)))];
      if (candidate) {
        attackerId = candidate.riderId;
        const top = byPerfDesc[0].perfScore;
        const favFloor = byPerfDesc[Math.min(FAVOURITE_COUNT, byPerfDesc.length) - 1].perfScore;
        const strength = Math.max(0, Math.min(1, (candidate.perfScore - favFloor) / (top - favFloor || 1)));
        const chance = Math.min(
          LATE_ATTACK_SUCCESS_MAX,
          LATE_ATTACK_SUCCESS_BASE +
            selectiveness * LATE_ATTACK_SUCCESS_TERRAIN_W +
            strength * LATE_ATTACK_SUCCESS_STRENGTH_W +
            (committedFav ? LATE_ATTACK_SUCCESS_TACTIC_BONUS : 0),
        );
        attackSucceeds = rng.next() < chance;
      }
    }
  }

  // --- jittered timeline ----------------------------------------------------
  const breakPeakT = BREAK_PEAK_T_MIN + rng.next() * (BREAK_PEAK_T_MAX - BREAK_PEAK_T_MIN);
  const finaleT = FINALE_T_MIN + rng.next() * (FINALE_T_MAX - FINALE_T_MIN);
  const catchT = breakSurvived ? Infinity : CATCH_T_MIN + rng.next() * (CATCH_T_MAX - CATCH_T_MIN);
  const breakMaxLead =
    (BREAK_MAX_LEAD_SEC_MIN + rng.next() * (BREAK_MAX_LEAD_SEC_MAX - BREAK_MAX_LEAD_SEC_MIN)) * (0.5 + friendliness);

  // --- final result + winning-move adjustments -------------------------------
  const result = perfToResult(stage, scored, timePenalties, dnfIds);
  const promoteToWin = (id: string, margin: number): void => {
    const fastestOther = result.order.find((e) => !e.dnf && e.riderId !== id);
    const w = result.order.find((e) => e.riderId === id);
    if (fastestOther && w) {
      w.timeSec = fastestOther.timeSec - margin;
      result.order.sort((a, b) => (a.dnf !== b.dnf ? (a.dnf ? 1 : -1) : a.timeSec - b.timeSec));
    }
  };
  if (breakSurvived && breakWinnerId) {
    promoteToWin(breakWinnerId, BREAK_WIN_MARGIN_SEC);
  } else if (attackSucceeds && attackerId) {
    promoteToWin(attackerId, LATE_ATTACK_MARGIN_MIN + rng.next() * (LATE_ATTACK_MARGIN_MAX - LATE_ATTACK_MARGIN_MIN));
  }

  // --- cluster finishers into same-time groups (SPEC §5.7) -------------------
  const groups = clusterGroups(result, groupThreshold(stage.type));

  const leadSize = groups[0]?.ids.length ?? 1;
  const shape: RaceShape = breakSurvived
    ? 'breakWins'
    : attackSucceeds
      ? 'soloAttack'
      : leadSize <= 4
        ? 'selective'
        : leadSize >= 8
          ? 'sprint'
          : 'mixed';

  // --- radio events ----------------------------------------------------------
  if (breakIds.length > 0) {
    events.push({ t: T_BREAK_GO + 0.01, kind: 'break', text: `Breakaway: ${breakIds.map(lastName).join(', ')}` });
    events.push({ t: breakPeakT, kind: 'info', text: `The break leads by ${fmtLead(breakMaxLead)}` });
    if (breakSurvived && breakWinnerId) {
      events.push({ t: 0.9, kind: 'break', text: `${lastName(breakWinnerId)} holds them off — the break makes it!` });
    } else {
      events.push({ t: Math.min(catchT, 0.86), kind: 'catch', text: 'The break is caught' });
    }
  }
  if (attackerId) {
    events.push({ t: finaleT, kind: 'attack', text: `${lastName(attackerId)} attacks!` });
    events.push(
      attackSucceeds
        ? { t: 0.95, kind: 'attack', text: `${lastName(attackerId)} goes clear — solo to the line!` }
        : { t: 0.96, kind: 'info', text: `${lastName(attackerId)} is brought back` },
    );
  } else if (!breakSurvived) {
    const finaleText =
      shape === 'selective' ? 'The lead group shatters!' : shape === 'sprint' ? "It's a bunch sprint!" : 'The favourites force the pace';
    events.push({ t: finaleT, kind: 'finale', text: finaleText });
  }
  events.sort((a, b) => a.t - b.t);

  // --- per-rider gap trajectories, quantized by group ------------------------
  const winnerTime = result.order[0].timeSec;
  const finalRank = new Map(result.order.map((e, i) => [e.riderId, i]));
  const stories = new Map<string, RiderStory>();

  for (const entry of result.order) {
    const id = entry.riderId;
    const inBreak = breakSet.has(id);
    const incident = incidents.get(id);
    const rank = finalRank.get(id) ?? 99;
    const finalGap = entry.dnf ? breakMaxLead + 250 : entry.timeSec - winnerTime;
    const isAttacker = id === attackerId;

    let role: RiderRole;
    if (incident) role = 'dropped';
    else if (inBreak) role = 'break';
    else if (isAttacker) role = 'attacker';
    else if (rank < FAVOURITE_COUNT) role = 'contender';
    else role = 'peloton';

    const fT = Math.min(0.97, finaleT + idJitter(id, 7) * 0.03);
    // keep the peak jitter tiny: bigger values spread the pack's gap curves so far
    // apart mid-race that the peloton visually shatters into phantom groups
    const pT = Math.max(0.15, breakPeakT + idJitter(id, 13) * 0.005);

    let gaps = buildGaps({
      role,
      inBreak,
      breakSurvived,
      isAttacker,
      attackSucceeds,
      finalGap,
      breakMaxLead,
      catchT,
      finaleT: fT,
      breakPeakT: pT,
      hasBreak: breakIds.length > 0,
    });
    if (incident) gaps = applyIncident(gaps, incident, finalGap);
    stories.set(id, { riderId: id, role, inBreak, gaps, incident });
  }

  return { result, groups, stories, events, breakIds, breakSurvived, attackerId, finaleT, shape };
}

function clusterGroups(result: StageResult, threshold: number): FinishGroup[] {
  const finishers = result.order.filter((e) => !e.dnf);
  const dnfs = result.order.filter((e) => e.dnf);
  const groups: FinishGroup[] = [];
  let current: StageResultEntry[] = [];
  for (const e of finishers) {
    if (current.length > 0 && e.timeSec - current[current.length - 1].timeSec > threshold) {
      groups.push({ ids: current.map((x) => x.riderId), timeSec: current[0].timeSec, gapSec: 0 });
      current = [];
    }
    current.push(e);
  }
  if (current.length > 0) groups.push({ ids: current.map((x) => x.riderId), timeSec: current[0].timeSec, gapSec: 0 });
  for (const g of groups) {
    g.gapSec = g.timeSec - groups[0].timeSec;
    for (const id of g.ids) result.order.find((e) => e.riderId === id)!.timeSec = g.timeSec;
  }
  result.order = [...groups.flatMap((g) => g.ids.map((id) => finishers.find((e) => e.riderId === id)!)), ...dnfs];
  return groups;
}

interface GapCtx {
  role: RiderRole;
  inBreak: boolean;
  breakSurvived: boolean;
  isAttacker: boolean;
  attackSucceeds: boolean;
  finalGap: number;
  breakMaxLead: number;
  catchT: number;
  finaleT: number;
  breakPeakT: number;
  hasBreak: boolean;
}

function buildGaps(o: GapCtx): GapKey[] {
  const g = o.finalGap;

  if (o.inBreak) {
    if (o.breakSurvived) {
      return [
        { t: 0, gap: 0 },
        { t: o.finaleT, gap: 0 },
        { t: 1, gap: g },
      ];
    }
    return [
      { t: 0, gap: 0 },
      { t: Math.min(o.catchT, 0.9), gap: 0 },
      { t: o.finaleT, gap: g * 0.4 },
      { t: 1, gap: g },
    ];
  }

  // in the peloton behind the break for most of the day…
  const packGapAtPeak = o.hasBreak && !o.breakSurvived ? o.breakMaxLead : o.breakSurvived ? o.breakMaxLead : 0;
  const preFinale: GapKey[] = [
    { t: 0, gap: 0 },
    { t: T_BREAK_GO, gap: 0 },
    { t: o.breakPeakT, gap: packGapAtPeak },
    { t: Math.min(o.catchT, 0.9), gap: o.breakSurvived ? Math.max(g * 0.7, 8) : 2 },
  ];

  if (o.isAttacker && o.attackSucceeds) {
    // jumps clear in the finale and stays away (winner, g = 0)
    return [
      ...preFinale,
      { t: o.finaleT, gap: 3 },
      { t: Math.min(o.finaleT + 0.03, 0.97), gap: 0 },
      { t: 1, gap: 0 },
    ];
  }

  if (o.breakSurvived) {
    return [...preFinale, { t: o.finaleT, gap: Math.max(g * 0.6, 8) }, { t: 1, gap: g }];
  }

  const finaleGap = o.role === 'contender' || o.isAttacker ? g * 0.3 : g * 0.6;
  return [...preFinale, { t: o.finaleT, gap: finaleGap + 1 }, { t: 1, gap: g }];
}

function applyIncident(base: GapKey[], incident: Incident, finalGap: number): GapKey[] {
  const tc = incident.t;
  const before = interpGap(base, tc);
  const kept = base.filter((k) => k.t < tc);
  kept.push({ t: tc, gap: before });
  kept.push({ t: Math.min(tc + 0.04, 0.99), gap: before + 45 });
  kept.push({ t: 1, gap: finalGap });
  return kept;
}
