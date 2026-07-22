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
} from '../data/tuning.ts';
import type { StageResult } from '../data/types.ts';
import { perfToResult, scoreRiders, type StageSimInput } from './stageSim.ts';

/**
 * Race narrative layer (SPEC §5.9). A thin layer over the scoring engine that
 * (a) lets a few bounded events adjust the result — a breakaway that can stay
 * away, crashes/punctures — and (b) produces a RaceStory of gap-to-leader
 * keyframes so the field can be *watched* forming a break, chasing it back,
 * splintering, and shedding riders. All seeded → reproducible.
 */

export type RiderRole = 'break' | 'peloton' | 'contender' | 'dropped';

export interface GapKey {
  t: number; // normalised stage time [0,1]
  gap: number; // seconds behind the current race leader
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
  gaps: GapKey[]; // sorted by t; ends at t=1 with the final gap
  incident?: Incident;
}

export interface RaceStory {
  result: StageResult;
  stories: Map<string, RiderStory>;
  breakIds: string[];
  breakSurvived: boolean;
}

// --- animation timeline (cosmetic fractions of the stage) ---
const T_BREAK_GO = 0.06;
const T_BREAK_PEAK = 0.4;
const T_FINALE = 0.88;
const PACK_SPREAD_CAP = 20; // pack riders sit within ~this many seconds mid-race
const RISKY_TYPES = new Set(['cobbled', 'descentFinish']);
const TOP_CONTENDERS = 6; // final placings treated as "attacked in the finale"

const clampGap = (g: number): number => Math.max(0, g);

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

export function buildRaceStory(input: StageSimInput): RaceStory {
  const { stage, rng } = input;
  const scored = scoreRiders(input);
  const isItt = stage.type === 'itt';

  // --- breakaway membership -------------------------------------------------
  const byPerfDesc = [...scored].sort((a, b) => b.perfScore - a.perfScore);
  const committed = new Set<string>();
  for (const t of input.tacticsByTeam.values()) {
    if (t.strategy === 'BREAKAWAY') committed.add(t.protectedRiderId);
  }

  let breakIds: string[] = [];
  if (!isItt) {
    const size = BREAK_MIN_SIZE + rng.int(BREAK_MAX_SIZE - BREAK_MIN_SIZE + 1);
    // opportunists = riders outside the favourites, shuffled
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
      timePenalties.set(s.riderId, loss);
      if (dnf) dnfIds.add(s.riderId);
      incidents.set(s.riderId, {
        t: 0.2 + rng.next() * 0.6,
        type: rng.next() < 0.5 ? 'crash' : 'puncture',
        dnf,
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

  // --- final result ---------------------------------------------------------
  const result = perfToResult(stage, scored, timePenalties, dnfIds);
  if (breakSurvived && breakWinnerId) {
    const fastest = result.order.find((e) => !e.dnf);
    const bw = result.order.find((e) => e.riderId === breakWinnerId);
    if (fastest && bw) {
      bw.timeSec = fastest.timeSec - BREAK_WIN_MARGIN_SEC;
      result.order.sort((a, b) => (a.dnf !== b.dnf ? (a.dnf ? 1 : -1) : a.timeSec - b.timeSec));
    }
  }

  // --- build gap stories ----------------------------------------------------
  const winnerTime = result.order[0].timeSec;
  const finalRank = new Map(result.order.map((e, i) => [e.riderId, i]));
  const breakMaxLead = BREAK_MAX_LEAD_SEC_MIN + rng.next() * (BREAK_MAX_LEAD_SEC_MAX - BREAK_MAX_LEAD_SEC_MIN);
  const tCatch = breakSurvived ? 2 : 0.7 + rng.next() * 0.18; // >1 = never caught

  const stories = new Map<string, RiderStory>();
  for (const entry of result.order) {
    const id = entry.riderId;
    const finalGap = entry.dnf ? breakMaxLead + 200 : entry.timeSec - winnerTime;
    const inBreak = breakSet.has(id);
    const rank = finalRank.get(id) ?? 99;
    const incident = incidents.get(id);

    let role: RiderRole;
    if (incident) role = 'dropped';
    else if (inBreak) role = 'break';
    else if (rank < TOP_CONTENDERS) role = 'contender';
    else role = 'peloton';

    let gaps = buildGaps({
      role,
      inBreak,
      isWinner: id === breakWinnerId || rank === 0,
      finalGap,
      breakMaxLead,
      breakSurvived,
      tCatch,
      isItt,
    });
    if (incident) gaps = applyIncident(gaps, incident, finalGap);

    stories.set(id, { riderId: id, role, inBreak, gaps, incident });
  }

  return { result, stories, breakIds, breakSurvived };
}

interface GapOpts {
  role: RiderRole;
  inBreak: boolean;
  isWinner: boolean;
  finalGap: number;
  breakMaxLead: number;
  breakSurvived: boolean;
  tCatch: number;
  isItt: boolean;
}

function buildGaps(o: GapOpts): GapKey[] {
  const g = o.finalGap;

  if (o.isItt) {
    // solo effort: winner leads throughout, everyone else strings out steadily
    return [
      { t: 0, gap: 0 },
      { t: 0.5, gap: g * 0.5 },
      { t: 1, gap: g },
    ];
  }

  if (o.inBreak) {
    if (o.isWinner && o.breakSurvived) {
      return [
        { t: 0, gap: 0 },
        { t: T_FINALE, gap: 0 },
        { t: 1, gap: 0 },
      ];
    }
    const caught = o.breakSurvived ? T_FINALE : o.tCatch;
    return [
      { t: 0, gap: 0 },
      { t: T_BREAK_GO, gap: 0 },
      { t: T_BREAK_PEAK, gap: 0 },
      { t: Math.min(caught, 0.98), gap: 0 },
      { t: 1, gap: g },
    ];
  }

  const internal = Math.min(g, PACK_SPREAD_CAP);
  const breakLeadPeak = o.breakMaxLead;

  if (o.breakSurvived) {
    // pack never catches the break: they close some, but finish behind the winner
    return [
      { t: 0, gap: clampGap(internal * 0.4) },
      { t: T_BREAK_PEAK, gap: clampGap(breakLeadPeak + internal) },
      { t: T_FINALE, gap: clampGap(o.role === 'contender' ? g * 0.6 : g * 0.85) },
      { t: 1, gap: g },
    ];
  }

  // break gets caught: pack surges back to the front, then the finale opens up
  const finaleGap = o.role === 'contender' ? g * 0.3 : g * 0.6;
  return [
    { t: 0, gap: clampGap(internal * 0.4) },
    { t: T_BREAK_PEAK, gap: clampGap(breakLeadPeak + internal) },
    { t: Math.min(o.tCatch, 0.85), gap: clampGap(internal) },
    { t: T_FINALE, gap: clampGap(finaleGap) },
    { t: 1, gap: g },
  ];
}

/** Truncate the base trajectory at the incident and balloon the gap afterwards. */
function applyIncident(base: GapKey[], incident: Incident, finalGap: number): GapKey[] {
  const tc = incident.t;
  const before = interpGap(base, tc);
  const kept = base.filter((k) => k.t < tc);
  kept.push({ t: tc, gap: before });
  kept.push({ t: Math.min(tc + 0.04, 0.99), gap: before + 45 });
  kept.push({ t: 1, gap: finalGap });
  return kept;
}
