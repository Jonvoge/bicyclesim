import { RIDERS } from './riders.ts';
import type { Rider, StatKey } from './types.ts';

/**
 * The free-agent pool (Phase 5): unsigned riders on the market from day one, so
 * the player can strengthen the squad without waiting for a rival's contract to
 * lapse. Proxy names only (SPEC §9). `teamId: null` marks them unsigned; they
 * carry no contract until signed.
 *
 * A deliberately mixed bag — a couple of genuinely useful specialists worth
 * paying for, and cheaper journeymen to plug a gap — so signing is a real
 * budget choice, not a no-brainer. STARTING VALUES (SPEC §10).
 */

type Stats = Record<StatKey, number>;

function stats(
  climbing: number,
  flat: number,
  sprint: number,
  puncheur: number,
  endurance: number,
  stamina: number,
  consistency: number,
): Stats {
  return { climbing, flat, sprint, puncheur, endurance, stamina, consistency };
}

function agent(id: string, name: string, nationality: string, age: number, s: Stats): Rider {
  return { id, name, nationality, age, teamId: null, stats: s, currentFatigue: 0 };
}

export const FREE_AGENTS: Rider[] = [
  //                                       clm flat spr pun end sta con
  agent('fa-almeida', 'João Almeido', 'Portugal', 26, stats(87, 72, 42, 68, 85, 82, 80)), // GC climber — the prize signing
  agent('fa-cavendo', 'Marek Cavendo', 'Isle of Man', 33, stats(26, 60, 90, 54, 66, 64, 82)), // ageing pure sprinter, still fast
  agent('fa-turner', 'Ben Turnbull', 'UK', 24, stats(50, 78, 58, 66, 78, 74, 70)), // young rouleur / breakaway
  agent('fa-kron', 'Andreas Kron-Voss', 'Denmark', 27, stats(56, 70, 60, 82, 80, 76, 74)), // puncheur / classics
  agent('fa-narvaez', 'Jhon Narvaes', 'Ecuador', 28, stats(80, 58, 46, 74, 82, 78, 72)), // climbing all-rounder
  agent('fa-degen', 'Silvan Degel', 'Switzerland', 30, stats(40, 66, 78, 60, 74, 72, 76)), // sprinter / lead-out
  agent('fa-bystrom', 'Erik Byström', 'Sweden', 22, stats(64, 62, 52, 66, 74, 74, 60)), // raw young all-rounder, streaky
  agent('fa-oconnor', "Sean O'Doherty", 'Ireland', 29, stats(78, 64, 40, 60, 82, 80, 74)), // climbing domestique
  agent('fa-marchetti', 'Luca Marchetto', 'Italy', 31, stats(46, 74, 66, 72, 80, 76, 78)), // experienced rouleur
];

export const FREE_AGENTS_BY_ID: Map<string, Rider> = new Map(FREE_AGENTS.map((r) => [r.id, r]));

/**
 * Every rider that can appear in the game — the eight squads plus the free-agent
 * pool — keyed by id, for looking up immutable facts (name, nationality) anywhere
 * in the UI. Team membership and trained stats live on the mutable **dynasty**
 * roster (`src/state/dynasty.ts`), not here.
 */
export const ALL_RIDERS: Rider[] = [...RIDERS, ...FREE_AGENTS];
export const ALL_RIDERS_BY_ID: Map<string, Rider> = new Map(ALL_RIDERS.map((r) => [r.id, r]));
