import { RIDERS, RIDERS_BY_ID } from '../data/riders.ts';
import { TEAMS } from '../data/teams.ts';
import { RIVAL_MIN_STARTERS, RIVAL_REST_FATIGUE_MIN, RIVAL_REST_SUIT_MAX } from '../data/tuning.ts';
import type { Stage } from '../data/types.ts';
import { baseScore } from './stageSim.ts';

/**
 * Rival season management (Phase 4 follow-up). Rivals aren't just full-gas every
 * day — like the player, they **rest** riders who can't contest today's race and
 * are carrying fatigue, to save them for races that suit them. This keeps rival
 * stars fresher for their targets, so the season standings are a genuine contest
 * rather than a reward for the player being the only one who rotates a squad.
 *
 * Deterministic (a pure function of the carried fatigue + terrain). Pure/headless.
 */

/** Rival rider ids to bench for an event on `stage` (given carried season fatigue). */
export function rivalRestSet(fatigue: Map<string, number>, stage: Stage): Set<string> {
  const rest = new Set<string>();
  // suitability is relative to the strongest rider in the whole field for this terrain
  const fieldTop = Math.max(...RIDERS.map((r) => baseScore(r, stage)));

  for (const team of TEAMS) {
    if (team.isPlayer) continue;
    const riders = team.riderIds.map((id) => RIDERS_BY_ID.get(id)!);
    // candidates: tired AND ill-suited, worst-suited first
    const benchable = riders
      .map((r) => ({ id: r.id, suit: baseScore(r, stage) / fieldTop, fat: fatigue.get(r.id) ?? 0 }))
      .filter((c) => c.suit < RIVAL_REST_SUIT_MAX && c.fat > RIVAL_REST_FATIGUE_MIN)
      .sort((a, b) => a.suit - b.suit);
    // never drop below a minimum start count
    const maxRest = Math.max(0, riders.length - RIVAL_MIN_STARTERS);
    for (const c of benchable.slice(0, maxRest)) rest.add(c.id);
  }
  return rest;
}
