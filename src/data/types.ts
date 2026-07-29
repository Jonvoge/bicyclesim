/**
 * Core data model (SPEC §4).
 *
 * MVP only populates the non-optional fields; the optional ones arrive in later
 * phases (noted per field) but live here now so the shape is the executable spec.
 */

export type StatKey =
  | 'climbing'
  | 'flat' // flat-road power / engine (rouleur, breakaway, cobbles; the eventual TT stat)
  | 'sprint'
  | 'puncheur'
  | 'endurance'
  | 'stamina'
  | 'consistency';

/** The offensive stats that stage weightings distribute over (SPEC §5.2). */
export type BaseStatKey = 'climbing' | 'flat' | 'sprint' | 'puncheur' | 'endurance';

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

  // --- season focus (Season Focus ext — docs/cycling-sim-SEASON-FOCUS.md) ---
  focusPlanId?: string; // which season-long Condition plan this rider is on (durable, defaulted by archetype)

  // --- runtime ---
  currentFatigue: number; // 0 = fresh; accumulates over a tour (Phase 3)
  condition?: number; // 0..1 today's planned form level, set on the stage copy per event (Season Focus ext)
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

export type DivisionId = 'world' | 'pro';

export type TeamPhilosophy = 'mountain' | 'classics' | 'sprint' | 'development' | 'balanced' | 'opportunist';

export interface TeamIdentity {
  id: string;
  name: string;
  shortName: string;
  country: string;
  primaryColor: number;
  accentColor: number;
  philosophy: TeamPhilosophy;
  foundedSeason: number;
  isPlayer: boolean;
}

export interface TeamSeasonState {
  division: DivisionId;
  rankingPoints: number;
  wins: number;
  bestPrestigeResult: number;
  reputation: number;
  budget: number;
  lastRank?: number;
}

export interface WildcardInvitation {
  teamId: string;
  reason: string;
}

export interface EventField {
  season: number;
  raceId: string;
  teamIds: string[];
  wildcards: WildcardInvitation[];
}

export type DirectorTacticalPreference = 'sprint-control' | 'break-hunting' | 'classics-aggression' | 'gc-protection';

export interface DirectorTarget {
  raceId: string;
  leaderId: string;
  reason: string;
}

export interface RivalDirectorPlan {
  season: number;
  teamId: string;
  targets: DirectorTarget[];
  tacticalPreference: DirectorTacticalPreference;
}

export interface RaceWinnerRecord {
  season: number;
  raceId: string;
  riderId: string;
  teamId: string;
}

export interface StageWinnerRecord extends RaceWinnerRecord {
  stageId: string;
}

export interface PromotionRecord {
  season: number;
  promotedTeamIds: string[];
  relegatedTeamIds: string[];
}

export interface TeamChampionRecord {
  season: number;
  division: DivisionId;
  teamId: string;
}

export interface SeasonHistory {
  season: number;
  riderChampionId?: string;
  teamChampionIds: Partial<Record<DivisionId, string>>;
}

export interface WorldHistory {
  seasons: SeasonHistory[];
  raceWinners: RaceWinnerRecord[];
  stageWinners: StageWinnerRecord[];
  promotions: PromotionRecord[];
  teamChampions: TeamChampionRecord[];
}

export interface WorldState {
  schemaVersion: number;
  seed: number;
  rngState?: number;
  teams: TeamIdentity[];
  teamSeasons: Record<string, TeamSeasonState>;
  eventFields: EventField[];
  directorPlans: RivalDirectorPlan[];
  history: WorldHistory;
}

export interface SquadProposal {
  id: string;
  riderIds: string[];
  archetypes: string[];
  totalRating: number;
  wageBill: number;
  averageAge: number;
}

export interface GeneratedWorldDraft {
  world: WorldState;
  riders: Rider[];
  proposals: SquadProposal[];
  diagnostics: WorldGenerationDiagnostics;
}

export interface WorldGenerationDiagnostics {
  proposalAttempts: number[];
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
  elevationProfile?: readonly number[]; // normalized 0..1 samples for the route graphic
}

export type RaceType = 'oneDay' | 'shortTour' | 'grandTour';

export interface RaceEligibility {
  division: DivisionId;
  fieldSize: number;
  wildcardSlots?: number;
  divisionPointsScale: number;
}

export interface Race {
  id: string;
  name: string; // proxy name
  type: RaceType;
  stageIds: string[]; // oneDay = 1 stage; shortTour = 4–5; grandTour = 8–10
  prestige: number; // points/reward weighting (Phase 4)
  eligibility: RaceEligibility;
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
