import {
  MAX_SQUAD_SIZE,
  MIN_SQUAD_SIZE,
  PRIZE_PER_POINT,
  PRO_SPONSOR_SCALE,
  PROMOTION_SUPPORT_PAYMENT,
  RELEGATION_PARACHUTE_PAYMENT,
  SPONSOR_BASE,
  SPONSOR_RANK_BONUS,
  SEASON_EVENT_POINTS,
} from '../data/tuning.ts';
import type { DivisionId, Rider } from '../data/types.ts';
import { riderSalary } from './rating.ts';

/**
 * Management layer — the money & squad **formulas** (Phase 5, SPEC §5-mgmt).
 * Pure and headless (no Phaser, no state): every function here is a calculation
 * or a validity check. The stateful transitions that consume them (signing,
 * releasing, training, the season rollover) live in `src/state/dynasty.ts`.
 *
 * One abstract currency. The loop: a season-start **sponsor** cheque plus
 * **prize money** as you race fund a **wage bill** paid at the rollover; signing
 * a free agent costs a one-off fee and adds salary to that bill. All numbers are
 * STARTING GUESSES (SPEC §10) — the real balance pass is Phase 8.
 */

/** A rider's per-season salary (stored on contract, else derived from stats). */
export function salaryOf(rider: Rider): number {
  return rider.salary ?? riderSalary(rider);
}

/** Total wage bill for a team: the salaries of every rider currently on it. */
export function wageBill(roster: Rider[], teamId: string): number {
  return roster.filter((r) => r.teamId === teamId).reduce((sum, r) => sum + salaryOf(r), 0);
}

/** How many riders a team currently carries. */
export function squadSize(roster: Rider[], teamId: string): number {
  return roster.reduce((n, r) => (r.teamId === teamId ? n + 1 : n), 0);
}

/**
 * Season-start sponsor income, scaled by last season's team ranking (better rank
 * → bigger cheque). `rankLastSeason` is 1-based; undefined (the opening season)
 * is treated as a mid-table finish so nobody is punished for having no history.
 */
export function sponsorIncome(
  rankLastSeason: number | undefined,
  numTeams: number,
  division: DivisionId = 'world',
  transition?: 'promoted' | 'relegated',
): number {
  const rank = rankLastSeason ?? (numTeams + 1) / 2;
  const scale = division === 'pro' ? PRO_SPONSOR_SCALE : 1;
  const support = transition === 'promoted'
    ? PROMOTION_SUPPORT_PAYMENT
    : transition === 'relegated'
      ? RELEGATION_PARACHUTE_PAYMENT
      : 0;
  return Math.round((SPONSOR_BASE + (numTeams - rank) * SPONSOR_RANK_BONUS) * scale + support);
}

/**
 * Prize money an event pays each team: for every finisher, their finishing-slot
 * points × the race prestige, summed by team and converted to cash. Mirrors the
 * season-points payout (SPEC §6) so racing well literally pays the bills.
 */
export function eventPrizeByTeam(
  classification: { riderId: string }[],
  prestige: number,
  teamOf: (riderId: string) => string | null,
): Map<string, number> {
  const byTeam = new Map<string, number>();
  for (let i = 0; i < classification.length; i++) {
    const points = SEASON_EVENT_POINTS[i];
    if (points === undefined) break;
    const teamId = teamOf(classification[i].riderId);
    if (!teamId) continue;
    const cash = (points * prestige) / 100 * PRIZE_PER_POINT;
    byTeam.set(teamId, (byTeam.get(teamId) ?? 0) + cash);
  }
  for (const [id, cash] of byTeam) byTeam.set(id, Math.round(cash));
  return byTeam;
}

export interface ActionCheck {
  ok: boolean;
  reason?: string;
}

/** Whether a team can sign a free agent for `fee` given its cash and squad size. */
export function canSign(budget: number, teamSize: number, fee: number): ActionCheck {
  if (teamSize >= MAX_SQUAD_SIZE) return { ok: false, reason: `Squad full (max ${MAX_SQUAD_SIZE})` };
  if (fee > budget) return { ok: false, reason: 'Not enough budget' };
  return { ok: true };
}

/** Whether a team can release a rider without dropping below the squad minimum. */
export function canRelease(teamSize: number): ActionCheck {
  if (teamSize <= MIN_SQUAD_SIZE) return { ok: false, reason: `Need at least ${MIN_SQUAD_SIZE} riders` };
  return { ok: true };
}
