import { RIDERS_BY_ID } from '../data/riders.ts';
import {
  BREAK_MAX_LEAD_SEC_MAX,
  BREAK_MAX_LEAD_SEC_MIN,
  BREAK_MAX_SIZE,
  BREAK_MIN_SIZE,
  BREAK_SURVIVE_PROB,
  BREAK_SURVIVE_PROB_TACTIC,
  BREAK_WIN_MARGIN_SEC,
  CRASH_DNF_FRACTION,
  CRASH_PROB,
  CRASH_PROB_MULTIPLIER_RISKY,
  CRASH_TIME_LOSS_MAX,
  CRASH_TIME_LOSS_MIN,
  GROUP_GAP_THRESHOLD_HARD_SEC,
  GROUP_GAP_THRESHOLD_ITT_SEC,
  GROUP_GAP_THRESHOLD_SEC,
} from '../data/tuning.ts';
import type { StageResult, StageResultEntry, StageType } from '../data/types.ts';
import { perfToResult, scoreRiders, type StageSimInput } from './stageSim.ts';

/**
 * Race narrative layer (SPEC §5.9), group-centric: a road race is the story of
 * GROUPS — a break forms, the peloton chases, the finale shatters the field, and
 * riders arrive in groups that share a finishing time (SPEC §5.7). This layer
 * turns the scoring engine's numbers into that story:
 *   - bounded events (breakaway survival, crashes/punctures) adjust the result
 *   - finishers are clustered into FinishGroups; whole group = same time
 *   - per-rider gap trajectories are quantized BY GROUP, so riders visibly ride
 *     together in bunches rather than strung out on a line
 *   - a RaceEvent list ("race radio") narrates it: break composition, incidents,
 *     the catch, the finale
 * Everything is seeded → reproducible.
 */

export type RiderRole = 'break' | 'peloton' | 'contender' | 'dropped';

export interface GapKey {
  t: number; // normalised stage time [0,1]
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

/** Riders who cross the line together and share a time (SPEC §5.7). */
export interface FinishGroup {
  ids: string[]; // crossing order within the group
  timeSec: number;
  gapSec: number; // to the winning group
}

export interface RaceStory {
  result: StageResult;
  groups: FinishGroup[];
  stories: Map<string, RiderStory>;
  events: RaceEvent[];
  breakIds: string[];
  breakSurvived: boolean;
}

// --- narrative timeline (fractions of the stage; cosmetic) ---
export const T_BREAK_GO = 0.06;
export const T_BREAK_PEAK = 0.4;
export const T_FINALE = 0.88;
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
  const name = RIDERS_BY_ID.get(riderId)?.name ?? riderId;
  return name.split(' ').slice(-1)[0];
}

function fmtLead(sec: number): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m > 0 ? `${m}:${String(ss).padStart(2, '0')}` : `${ss}s`;
}

function groupThreshold(type: StageType): number {
  if (type === 'itt' || type === 'ttt') return GROUP_GAP_THRESHOLD_ITT_SEC;
  if (type === 'mountain' || type === 'summitFinish') return GROUP_GAP_THRESHOLD_HARD_SEC;
  return GROUP_GAP_THRESHOLD_SEC;
}

export function buildRaceStory(input: StageSimInput): RaceStory {
  const { stage, rng } = input;
  const scored = scoreRiders(input);
  const isItt = stage.type === 'itt' || stage.type === 'ttt';
  const events: RaceEvent[] = [];

  // --- breakaway membership -------------------------------------------------
  const byPerfDesc = [...scored].sort((a, b) => b.perfScore - a.perfScore);
  const committed = new Set<string>();
  for (const t of input.tacticsByTeam.values()) {
    if (t.strategy === 'BREAKAWAY') committed.add(t.protectedRiderId);
  }

  let breakIds: string[] = [];
  if (!isItt) {
    const size = BREAK_MIN_SIZE + rng.int(BREAK_MAX_SIZE - BREAK_MIN_SIZE + 1);
    const opportunists = byPerfDesc
      .slice(TOP_CONTENDERS)
      .map((s) => s.riderId)
      .filter((id) => !committed.has(id));
    for (let i = opportunists.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [opportunists[i], opportunists[j]] = [opportunists[j], opportunists[i]];
    }
    const chosen = [...committed];
    for (const id of opportunists) {
      if (chosen.length >= size) break;
      chosen.push(id);
    }
    breakIds = chosen;
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
      const inc: Incident = {
        t: 0.2 + rng.next() * 0.6,
        type: rng.next() < 0.5 ? 'crash' : 'puncture',
        dnf,
      };
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

  // --- does the break stay away? --------------------------------------------
  let breakSurvived = false;
  let breakWinnerId: string | null = null;
  if (breakIds.length > 0) {
    const prob = [...committed].some((id) => breakSet.has(id))
      ? BREAK_SURVIVE_PROB_TACTIC
      : BREAK_SURVIVE_PROB;
    if (rng.next() < prob) {
      const alive = byPerfDesc.filter((s) => breakSet.has(s.riderId) && !dnfIds.has(s.riderId));
      if (alive.length > 0) {
        breakSurvived = true;
        breakWinnerId = alive[0].riderId;
      }
    }
  }
  const tCatch = breakSurvived ? Infinity : 0.68 + rng.next() * 0.18;
  const breakMaxLead =
    BREAK_MAX_LEAD_SEC_MIN + rng.next() * (BREAK_MAX_LEAD_SEC_MAX - BREAK_MAX_LEAD_SEC_MIN);

  // --- raw result, then survived-break adjustment ---------------------------
  const result = perfToResult(stage, scored, timePenalties, dnfIds);
  if (breakSurvived && breakWinnerId) {
    const fastestOther = result.order.find((e) => !e.dnf && e.riderId !== breakWinnerId);
    const bw = result.order.find((e) => e.riderId === breakWinnerId);
    if (fastestOther && bw) {
      bw.timeSec = fastestOther.timeSec - BREAK_WIN_MARGIN_SEC;
      result.order.sort((a, b) => (a.dnf !== b.dnf ? (a.dnf ? 1 : -1) : a.timeSec - b.timeSec));
    }
  }

  // --- cluster finishers into groups; whole group shares a time (SPEC §5.7) --
  const threshold = groupThreshold(stage.type);
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
  if (current.length > 0) {
    groups.push({ ids: current.map((x) => x.riderId), timeSec: current[0].timeSec, gapSec: 0 });
  }
  for (const g of groups) {
    g.gapSec = g.timeSec - groups[0].timeSec;
    for (const id of g.ids) {
      const entry = result.order.find((e) => e.riderId === id)!;
      entry.timeSec = g.timeSec; // same group, same time
    }
  }
  result.order = [...groups.flatMap((g) => g.ids.map((id) => finishers.find((e) => e.riderId === id)!)), ...dnfs];

  // --- radio events ----------------------------------------------------------
  if (breakIds.length > 0) {
    events.push({
      t: T_BREAK_GO + 0.01,
      kind: 'break',
      text: `Breakaway: ${breakIds.map(lastName).join(', ')}`,
    });
    events.push({
      t: T_BREAK_PEAK,
      kind: 'info',
      text: `The break leads by ${fmtLead(breakMaxLead)}`,
    });
    if (breakSurvived && breakWinnerId) {
      events.push({ t: 0.93, kind: 'break', text: `${lastName(breakWinnerId)} is going to make it!` });
    } else {
      events.push({ t: Math.min(tCatch, 0.86), kind: 'catch', text: 'The break is caught' });
    }
  }
  if (!isItt) {
    events.push({ t: T_FINALE, kind: 'finale', text: 'Finale — the favourites attack!' });
  } else {
    events.push({ t: 0.05, kind: 'info', text: 'First riders on course' });
    events.push({ t: 0.55, kind: 'info', text: 'Halfway splits coming in' });
  }
  events.sort((a, b) => a.t - b.t);

  // --- per-rider gap trajectories, quantized by finish group ------------------
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

    let gaps: GapKey[];
    if (isItt) {
      gaps = [
        { t: 0, gap: 0 },
        { t: 0.5, gap: finalGap * 0.5 },
        { t: 1, gap: finalGap },
      ];
    } else if (inBreak) {
      if (breakSurvived) {
        // survivors ride clear all day; non-winners drift to their final group late
        gaps = [
          { t: 0, gap: 0 },
          { t: T_FINALE, gap: 0 },
          { t: 1, gap: finalGap },
        ];
      } else {
        gaps = [
          { t: 0, gap: 0 },
          { t: Math.min(tCatch, 0.86), gap: 0 },
          { t: T_FINALE, gap: finalGap * 0.4 },
          { t: 1, gap: finalGap },
        ];
      }
    } else if (breakSurvived) {
      gaps = [
        { t: 0, gap: 0 },
        { t: T_BREAK_GO, gap: 0 },
        { t: T_BREAK_PEAK, gap: breakMaxLead },
        { t: T_FINALE, gap: Math.max(finalGap * 0.6, 8) },
        { t: 1, gap: finalGap },
      ];
    } else {
      gaps = [
        { t: 0, gap: 0 },
        { t: T_BREAK_GO, gap: 0 },
        { t: T_BREAK_PEAK, gap: breakIds.length > 0 ? breakMaxLead : 0 },
        { t: Math.min(tCatch, 0.86), gap: 2 },
        { t: T_FINALE, gap: finalGap * 0.35 + 1 },
        { t: 1, gap: finalGap },
      ];
    }
    if (incident) gaps = applyIncident(gaps, incident, finalGap);

    stories.set(id, { riderId: id, role, inBreak, gaps, incident });
  }

  return { result, groups, stories, events, breakIds, breakSurvived };
}

/** Truncate the trajectory at the incident and balloon the gap afterwards. */
function applyIncident(base: GapKey[], incident: Incident, finalGap: number): GapKey[] {
  const tc = incident.t;
  const before = interpGap(base, tc);
  const kept = base.filter((k) => k.t < tc);
  kept.push({ t: tc, gap: before });
  kept.push({ t: Math.min(tc + 0.04, 0.99), gap: before + 45 });
  kept.push({ t: 1, gap: finalGap });
  return kept;
}
