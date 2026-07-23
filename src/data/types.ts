/**
 * Core data model (SPEC §4).
 *
 * MVP only populates the non-optional fields; the optional ones arrive in later
 * phases (noted per field) but live here now so the shape is the executable spec.
 */

export type StatKey =
  | 'climbing'
  | 'timeTrial'
  | 'sprint'
  | 'puncheur'
  | 'endurance'
  | 'stamina'
  | 'consistency';

/** The offensive stats that stage weightings distribute over (SPEC §5.2). */
export type BaseStatKey = 'climbing' | 'timeTrial' | 'sprint' | 'puncheur' | 'endurance';

export interface Rider {
  id: string;
  name: string; // proxy name
  nationality: string;
  age: number;
  stats: Record<StatKey, number>; // each 1–100
  teamId: string | null;

  // --- development (Phase 6) ---
  peakAge?: number;
  ceiling?: Partial<Record<StatKey, number>>;
  developmentRate?: number;

  // --- runtime ---
  currentFatigue: number; // 0 = fresh; accumulates over a tour (Phase 3)
  isInjured?: boolean; // Phase 3+

  // --- economy (Phase 5) ---
  salary?: number;
  contractSeasonsLeft?: number;
}

export interface Team {
  id: string;
  name: string; // proxy name
  riderIds: string[];
  isPlayer: boolean;
  budget?: number; // Phase 5
}

// Time trials (itt) and team time trials (ttt) are deferred — they are a
// fundamentally different kind of racing and will get their own approach later.
export type StageType =
  | 'flat'
  | 'hilly'
  | 'mountain'
  | 'summitFinish'
  | 'descentFinish'
  | 'cobbled';

export interface Stage {
  id: string;
  name: string;
  type: StageType;
  lengthKm: number; // drives base time + difficulty
}

export type RaceType = 'oneDay' | 'shortTour' | 'grandTour';

export interface Race {
  id: string;
  name: string; // proxy name
  type: RaceType;
  stageIds: string[]; // oneDay = 1 stage; shortTour = 4–5; grandTour = 8–10
  prestige: number; // points/reward weighting (Phase 4)
}

export interface StageResultEntry {
  riderId: string;
  perfScore: number;
  timeSec: number;
  dnf: boolean;
}

export interface StageResult {
  stageId: string;
  order: StageResultEntry[]; // sorted best (winner) first
}

export interface GcEntry {
  riderId: string;
  totalTimeSec: number;
}
