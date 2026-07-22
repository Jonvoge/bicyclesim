import { RIDERS_BY_ID } from '../data/riders.ts';
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
  BREAK_SURVIVE_STRENGTH_W,
  BREAK_SURVIVE_TACTIC_BONUS,
  BREAK_SURVIVE_TERRAIN_W,
  BREAK_WIN_MARGIN_SEC,
  CATCH_T_MAX,
  CATCH_T_MIN,
  CRASH_DNF_FRACTION,
  CRASH_PROB,
  CRASH_PROB_MULTIPLIER_RISKY,
  CRASH_TIME_LOSS_MAX,
  CRASH_TIME_LOSS_MIN,
  FINALE_T_MAX,
  FINALE_T_MIN,
  GROUP_GAP_THRESHOLD_HARD_SEC,
  GROUP_GAP_THRESHOLD_SEC,
} from '../data/tuning.ts';
import type { StageResult, StageResultEntry, StageType } from '../data/types.ts';
import { perfToResult, scoreRiders, type ScoredRider, type StageSimInput } from './stageSim.ts';

/**
 * Race narrative layer (SPEC §5.9), group-centric and NON-formulaic: rather than
 * scripting the same break→catch→finale every time, the shape of the race emerges
 * from terrain, the break's strength, and dice:
 *   - whether a break survives depends on how break-friendly the course is and how
 *     strong the break is (a committed player rider tips the odds)
 *   - break peak, catch time and the finale are all jittered per race — some days
 *     the break is caught early, some days it holds to the line, some days it comes
 *     down to a bunch sprint with no real "finale" at all
 *   - finishers cluster into groups that share a time (SPEC §5.7)
 * Everything is seeded → reproducible.
 */

export type RiderRole = 'break' | 'peloton' | 'contender' | 'dropped';
export type RaceShape = 'breakWins' | 'selective' | 'sprint' | 'mixed';

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

export type RaceEventKind = 'break' | 'crash' | 'puncture' | 'catch' | 'finale' | 'info' | 'finish';

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
  finaleT: number;
  shape: RaceShape;
}

const T_BREAK_GO = 0.06;
const RISKY_TYPES = new Set(['cobbled', 'descentFinish']);
const TOP_CONTENDERS = 6;

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

/** Deterministic per-rider jitter in [-1,1] from a string id + salt. */
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

  // --- breakaway membership -------------------------------------------------
  const byPerfDesc = [...scored].sort((a, b) => b.perfScore - a.perfScore);
  const committed = new Set<string>();
  for (const t of input.tacticsByTeam.values()) {
    if (t.strategy === 'BREAKAWAY') committed.add(t.protectedRiderId);
  }

  const size = BREAK_MIN_SIZE + rng.int(BREAK_MAX_SIZE - BREAK_MIN_SIZE + 1);
  const opportunists = byPerfDesc
    .slice(TOP_CONTENDERS)
    .map((s) => s.riderId)
    .filter((id) => !committed.has(id));
  for (let i = opportunists.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [opportunists[i], opportunists[j]] = [opportunists[j], opportunists[i]];
  }
  const breakIds = [...committed];
  for (const id of opportunists) {
    if (breakIds.length >= size) break;
    breakIds.push(id);
  }
  const breakSet = new Set(breakIds);

  // --- incidents (SPEC §5.6) ------------------------------------------------
  const timePenalties = new Map<string, number>();
  const dnfIds = new Set<string>();
  const incidents = new Map<string, Incident>();
  const riskyMult = RISKY_TYPES.has(stage.type) ? CRASH_PROB_MULTIPLIER_RISKY : 1;
  for (const s of scored) {
    if (rng.next() < CRASH_PROB * riskyMult) {
      const dnf = rng.next() < CRASH_DNF_FRACTION;
      const loss = CRASH_TIME_LOSS_MIN + rng.next() * (CRASH_TIME_LOSS_MAX - CRASH_TIME_LOSS_MIN);
      const inc: Incident = { t: 0.2 + rng.next() * 0.6, type: rng.next() < 0.5 ? 'crash' : 'puncture', dnf };
      timePenalties.set(s.riderId, loss);
      if (dnf) dnfIds.add(s.riderId);
      incidents.set(s.riderId, inc);
      events.push({
        t: inc.t,
        kind: inc.type,
        text: `${inc.type === 'crash' ? 'Crash!' : 'Puncture!'} ${lastName(s.riderId)}${dnf ? ' — abandons' : ''}`,
      });
    }
  }

  // --- does the break survive? emergent from terrain + strength + tactic ------
  const breakStrength = breakStrengthOf(breakIds, byPerfDesc);
  const committedInBreak = [...committed].some((id) => breakSet.has(id));
  const survivalChance = Math.min(
    BREAK_SURVIVE_MAX,
    BREAK_SURVIVE_BASE +
      BREAK_SURVIVE_TERRAIN_W * friendliness +
      BREAK_SURVIVE_STRENGTH_W * breakStrength +
      (committedInBreak ? BREAK_SURVIVE_TACTIC_BONUS : 0),
  );
  let breakSurvived = false;
  let breakWinnerId: string | null = null;
  if (breakIds.length > 0 && rng.next() < survivalChance) {
    const alive = byPerfDesc.filter((s) => breakSet.has(s.riderId) && !dnfIds.has(s.riderId));
    if (alive.length > 0) {
      breakSurvived = true;
      breakWinnerId = alive[0].riderId;
    }
  }

  // --- jittered timeline ----------------------------------------------------
  const breakPeakT = BREAK_PEAK_T_MIN + rng.next() * (BREAK_PEAK_T_MAX - BREAK_PEAK_T_MIN);
  const finaleT = FINALE_T_MIN + rng.next() * (FINALE_T_MAX - FINALE_T_MIN);
  const catchT = breakSurvived ? Infinity : CATCH_T_MIN + rng.next() * (CATCH_T_MAX - CATCH_T_MIN);
  const breakMaxLead =
    (BREAK_MAX_LEAD_SEC_MIN + rng.next() * (BREAK_MAX_LEAD_SEC_MAX - BREAK_MAX_LEAD_SEC_MIN)) *
    (0.5 + friendliness);

  // --- final result + survived-break adjustment -----------------------------
  const result = perfToResult(stage, scored, timePenalties, dnfIds);
  if (breakSurvived && breakWinnerId) {
    const fastestOther = result.order.find((e) => !e.dnf && e.riderId !== breakWinnerId);
    const bw = result.order.find((e) => e.riderId === breakWinnerId);
    if (fastestOther && bw) {
      bw.timeSec = fastestOther.timeSec - BREAK_WIN_MARGIN_SEC;
      result.order.sort((a, b) => (a.dnf !== b.dnf ? (a.dnf ? 1 : -1) : a.timeSec - b.timeSec));
    }
  }

  // --- cluster finishers into same-time groups (SPEC §5.7) -------------------
  const groups = clusterGroups(result, groupThreshold(stage.type));

  // --- race shape (emergent from the actual lead group) ----------------------
  const leadSize = groups[0]?.ids.length ?? 1;
  const shape: RaceShape = breakSurvived
    ? 'breakWins'
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
      events.push({ t: Math.min(catchT, 0.9), kind: 'catch', text: 'The break is caught' });
    }
  }
  if (!breakSurvived) {
    const finaleText =
      shape === 'selective'
        ? 'Attacks fly — the lead group shatters!'
        : shape === 'sprint'
          ? "It's coming down to a bunch sprint!"
          : 'The favourites force the pace';
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

    let role: RiderRole;
    if (incident) role = 'dropped';
    else if (inBreak) role = 'break';
    else if (rank < TOP_CONTENDERS) role = 'contender';
    else role = 'peloton';

    // small per-rider jitter so the field doesn't move in perfect lockstep
    const fT = Math.min(0.97, finaleT + idJitter(id, 7) * 0.03);
    const pT = Math.max(0.15, breakPeakT + idJitter(id, 13) * 0.04);

    let gaps = buildGaps({ role, inBreak, breakSurvived, finalGap, breakMaxLead, catchT, finaleT: fT, breakPeakT: pT, hasBreak: breakIds.length > 0 });
    if (incident) gaps = applyIncident(gaps, incident, finalGap);
    stories.set(id, { riderId: id, role, inBreak, gaps, incident });
  }

  return { result, groups, stories, events, breakIds, breakSurvived, finaleT, shape };
}

/**
 * How strong is the break, measured against the FAVOURITES (not the whole field):
 * 0 if the break's best rider is no better than the weakest favourite (typical
 * opportunist break), →1 as it approaches the strongest rider in the race. So a
 * break only becomes "strong" when a genuine contender is up the road.
 */
function breakStrengthOf(breakIds: string[], byPerfDesc: ScoredRider[]): number {
  if (breakIds.length === 0) return 0;
  const top = byPerfDesc[0].perfScore;
  const contenderFloor = byPerfDesc[Math.min(TOP_CONTENDERS, byPerfDesc.length) - 1].perfScore;
  const set = new Set(breakIds);
  const best = Math.max(...byPerfDesc.filter((s) => set.has(s.riderId)).map((s) => s.perfScore));
  return Math.max(0, Math.min(1, (best - contenderFloor) / (top - contenderFloor || 1)));
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

  if (o.breakSurvived) {
    // chasers never quite close it down
    return [
      { t: 0, gap: 0 },
      { t: T_BREAK_GO, gap: 0 },
      { t: o.breakPeakT, gap: o.breakMaxLead },
      { t: o.finaleT, gap: Math.max(g * 0.6, 8) },
      { t: 1, gap: g },
    ];
  }

  return [
    { t: 0, gap: 0 },
    { t: T_BREAK_GO, gap: 0 },
    { t: o.breakPeakT, gap: o.hasBreak ? o.breakMaxLead : 0 },
    { t: Math.min(o.catchT, 0.9), gap: 2 },
    { t: o.finaleT, gap: g * 0.35 + 1 },
    { t: 1, gap: g },
  ];
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
