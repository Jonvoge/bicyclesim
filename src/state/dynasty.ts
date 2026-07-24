import { ALL_RIDERS } from '../data/freeAgents.ts';
import { RACES_BY_ID, SEASON_CALENDAR } from '../data/races.ts';
import { TEAMS, PLAYER_TEAM } from '../data/teams.ts';
import type { Stage } from '../data/types.ts';
import { defaultTeamTacticsFor } from '../sim/raceSetup.ts';
import type { TeamTactics } from '../sim/tactics.ts';
import {
  CONTRACT_MAX_SEASONS,
  CONTRACT_MIN_SEASONS,
  FREE_AGENT_POOL_CAP,
  MIN_SQUAD_SIZE,
  NEW_RIDERS_PER_SEASON,
  OFFSEASON_RECOVERY_RATE,
  RIVAL_STARTING_BUDGET,
  STARTING_BUDGET,
  TRAIN_FATIGUE_COST,
} from '../data/tuning.ts';
import type { Rider, StatKey } from '../data/types.ts';
import { ageOneSeason, generateProspect, scoutReport, seedDevelopment, shouldRetire } from '../sim/development.ts';
import {
  canRelease,
  canSign,
  eventPrizeByTeam,
  salaryOf,
  sponsorIncome,
  squadSize,
  trainingGain,
  wageBill,
  type ActionCheck,
} from '../sim/management.ts';
import { riderRating, riderSalary, signingFeeFor } from '../sim/rating.ts';
import { Rng } from '../sim/rng.ts';
import {
  createSeason,
  finishEvent,
  teamStandings,
  type SeasonResult,
  type SeasonState,
} from '../sim/season.ts';
import type { TourState } from '../sim/standings.ts';

/**
 * Dynasty state (Phase 5): the game's **mutable** layer. Where a `SeasonState`
 * only knows points + fatigue for one season, the dynasty owns the things
 * management changes and that must persist across seasons — the live **roster**
 * (who's on which team, their trained stats, their contracts), each team's
 * **budget**, and the season number — with the in-progress `SeasonState` nested
 * inside it.
 *
 * The roster here is the single source of truth for team membership: `RIDERS`
 * (`src/data`) is the immutable *starting* line-up; once a dynasty begins, always
 * read `dynasty.roster` (or the accessors below), never the static team lists.
 * Kept out of `src/sim` on purpose — it's stateful; the pure formulas it uses
 * live in `src/sim/management.ts` and `src/sim/rating.ts`.
 */

export interface DynastyState {
  seasonNumber: number;
  roster: Rider[]; // live clones of every rider; teamId = current team (null = free agent)
  budgets: Record<string, number>; // teamId → cash
  season: SeasonState; // the season currently being contested
  lastTeamRank: Record<string, number>; // teamId → last season's finishing rank (sponsor income)
  trainedThisGap: string[]; // rider ids trained since the last race (one session per gap)
}

function cloneRider(r: Rider): Rider {
  return { ...r, stats: { ...r.stats } };
}

/** Deterministic 1..N contract length from a rider id (so a new game is reproducible). */
function seedContract(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  const span = CONTRACT_MAX_SEASONS - CONTRACT_MIN_SEASONS + 1;
  return CONTRACT_MIN_SEASONS + (h % span);
}

/** A fresh dynasty: clone the roster, price contracts, seed budgets and season 1. */
export function createDynasty(): DynastyState {
  const roster = ALL_RIDERS.map(cloneRider);
  for (const r of roster) {
    seedDevelopment(r); // hidden peakAge / ceiling / developmentRate (Phase 6)
    if (r.teamId) {
      r.salary = riderSalary(r);
      r.contractSeasonsLeft = seedContract(r.id);
    } else {
      r.salary = undefined;
      r.contractSeasonsLeft = undefined;
    }
  }
  const budgets: Record<string, number> = {};
  for (const t of TEAMS) budgets[t.id] = t.isPlayer ? STARTING_BUDGET : RIVAL_STARTING_BUDGET;
  return {
    seasonNumber: 1,
    roster,
    budgets,
    season: createSeason(SEASON_CALENDAR),
    lastTeamRank: {},
    trainedThisGap: [],
  };
}

// --- accessors (always read team membership through these) --------------------

export function rosterById(dynasty: DynastyState): Map<string, Rider> {
  return new Map(dynasty.roster.map((r) => [r.id, r]));
}

export function teamOf(dynasty: DynastyState, riderId: string): string | null {
  return dynasty.roster.find((r) => r.id === riderId)?.teamId ?? null;
}

export function teamRiders(dynasty: DynastyState, teamId: string): Rider[] {
  return dynasty.roster.filter((r) => r.teamId === teamId);
}

export function playerRiders(dynasty: DynastyState): Rider[] {
  return teamRiders(dynasty, PLAYER_TEAM.id);
}

export function freeAgents(dynasty: DynastyState): Rider[] {
  return dynasty.roster.filter((r) => r.teamId === null);
}

/** The field for a race: every rider currently under contract (free agents sit out). */
export function racingRoster(dynasty: DynastyState): Rider[] {
  return dynasty.roster.filter((r) => r.teamId !== null);
}

export function playerBudget(dynasty: DynastyState): number {
  return dynasty.budgets[PLAYER_TEAM.id] ?? 0;
}

export function playerWageBill(dynasty: DynastyState): number {
  return wageBill(dynasty.roster, PLAYER_TEAM.id);
}

// --- transfers & training -----------------------------------------------------

/** Sign a free agent to a team (default: the player's), paying the signing fee. */
export function signRider(dynasty: DynastyState, riderId: string, teamId: string = PLAYER_TEAM.id): ActionCheck {
  const rider = dynasty.roster.find((r) => r.id === riderId);
  if (!rider) return { ok: false, reason: 'Unknown rider' };
  if (rider.teamId !== null) return { ok: false, reason: 'Not a free agent' };
  const fee = signingFeeFor(riderRating(rider));
  const check = canSign(dynasty.budgets[teamId] ?? 0, squadSize(dynasty.roster, teamId), fee);
  if (!check.ok) return check;
  dynasty.budgets[teamId] -= fee;
  rider.teamId = teamId;
  rider.salary = riderSalary(rider);
  rider.contractSeasonsLeft = CONTRACT_MAX_SEASONS;
  return { ok: true };
}

/** Release a rider to free agency (cuts the wage bill; no fee returned). */
export function releaseRider(dynasty: DynastyState, riderId: string): ActionCheck {
  const rider = dynasty.roster.find((r) => r.id === riderId);
  if (!rider || rider.teamId === null) return { ok: false, reason: 'Not on a team' };
  const check = canRelease(squadSize(dynasty.roster, rider.teamId));
  if (!check.ok) return check;
  rider.teamId = null;
  rider.salary = undefined;
  rider.contractSeasonsLeft = undefined;
  return { ok: true };
}

export interface TrainResult extends ActionCheck {
  gain?: number;
}

/**
 * Coach a rider: nudge one stat up (diminishing returns, capped) at the cost of
 * added season fatigue. One session per rider per race gap — the fatigue is the
 * real limiter (a rider trained hard arrives at their next race tired).
 */
export function trainRider(dynasty: DynastyState, riderId: string, stat: StatKey): TrainResult {
  const rider = dynasty.roster.find((r) => r.id === riderId);
  if (!rider || rider.teamId === null) return { ok: false, reason: 'Not on a team' };
  if (dynasty.trainedThisGap.includes(riderId)) return { ok: false, reason: 'Already trained this gap' };
  const gain = trainingGain(rider.stats[stat]);
  if (gain <= 0) return { ok: false, reason: 'Stat already maxed' };
  rider.stats[stat] = Math.round((rider.stats[stat] + gain) * 10) / 10;
  dynasty.season.fatigue.set(riderId, (dynasty.season.fatigue.get(riderId) ?? 0) + TRAIN_FATIGUE_COST);
  dynasty.trainedThisGap.push(riderId);
  return { ok: true, gain };
}

// --- event & season transitions ----------------------------------------------

/**
 * Finish a race event: bank it in the season (points + carried fatigue), pay out
 * prize money to teams, and open a fresh training gap. Wraps `season.finishEvent`
 * so the UI has one call. Pass the dynasty roster so team membership/standings
 * read the *current* squads.
 */
export function finishSeasonEvent(dynasty: DynastyState, tour: TourState): SeasonResult {
  const result = finishEvent(dynasty.season, tour, dynasty.roster);
  const race = RACES_BY_ID.get(result.raceId)!;
  const prize = eventPrizeByTeam(result.classification, race.prestige, (id) => teamOf(dynasty, id));
  for (const [teamId, cash] of prize) dynasty.budgets[teamId] = (dynasty.budgets[teamId] ?? 0) + cash;
  dynasty.trainedThisGap = [];
  return result;
}

export interface RolloverSummary {
  seasonNumber: number; // the season just finished
  teamRank: number; // the player's finishing rank
  sponsor: number; // player's sponsor cheque
  wages: number; // player's wage bill paid
  net: number; // sponsor − wages
  expiring: string[]; // player rider ids whose contract ran out (auto-renewed for now)
  retired: string[]; // player rider ids who retired this off-season
  retiredAll: number; // peloton-wide retirements
  emerged: number; // new prospects who turned pro into the free-agent pool
  autoSigned: string[]; // player rider ids called up automatically to fill a hole
}

/** Put a free agent onto a team (internal auto-fill; no fee, a fresh contract). */
function assignToTeam(rider: Rider, teamId: string): void {
  rider.teamId = teamId;
  rider.salary = riderSalary(rider);
  rider.contractSeasonsLeft = CONTRACT_MAX_SEASONS;
}

/**
 * Roll into the next season (Phase 5 economy + Phase 6 development):
 * 1. settle each team's books (sponsor cheque minus the wage bill just paid);
 * 2. **age the whole peloton one season** and move every rider along their
 *    individual curve (grow → plateau → decline, SPEC §7);
 * 3. **retire** veterans (odds rising with age); tick contracts on the survivors;
 * 4. bring in a crop of **young prospects** (free agents with fuzzy potential),
 *    auto-fill any squad left short, and cull the weakest spares to bound the pool;
 * 5. rest the peloton over the winter and start a fresh calendar.
 * Deterministic under a per-season rng. Returns a summary for the UI.
 */
export function rolloverSeason(dynasty: DynastyState): RolloverSummary {
  const numTeams = TEAMS.length;
  const playerId = PLAYER_TEAM.id;
  const finishedSeason = dynasty.seasonNumber;
  const rng = new Rng((0x5ea5000 ^ finishedSeason) >>> 0);

  // rank teams by the season just finished (unlisted teams share the last place)
  const standings = teamStandings(dynasty.season, (id) => teamOf(dynasty, id));
  const rank: Record<string, number> = {};
  standings.forEach((row, i) => (rank[row.id] = i + 1));
  for (const t of TEAMS) if (rank[t.id] === undefined) rank[t.id] = numTeams;

  // settle finances for every team (on the squad that raced this season)
  for (const t of TEAMS) {
    const income = sponsorIncome(dynasty.lastTeamRank[t.id], numTeams);
    dynasty.budgets[t.id] = Math.round((dynasty.budgets[t.id] ?? 0) + income - wageBill(dynasty.roster, t.id));
  }
  const playerSponsor = sponsorIncome(dynasty.lastTeamRank[playerId], numTeams);
  const playerWages = wageBill(dynasty.roster, playerId);

  // --- development: age + curve everyone, then retirements ---
  for (const r of dynasty.roster) ageOneSeason(r);
  const retired: string[] = [];
  let retiredAll = 0;
  const survivors: Rider[] = [];
  for (const r of dynasty.roster) {
    if (shouldRetire(r, rng)) {
      retiredAll++;
      if (r.teamId === playerId) retired.push(r.id);
    } else {
      survivors.push(r);
    }
  }
  dynasty.roster = survivors;

  // tick contracts on the survivors; expiring riders auto-renew (poaching → later)
  const expiring: string[] = [];
  for (const r of dynasty.roster) {
    if (r.teamId === null || r.contractSeasonsLeft === undefined) continue;
    r.contractSeasonsLeft -= 1;
    if (r.contractSeasonsLeft <= 0) {
      if (r.teamId === playerId) expiring.push(r.id);
      r.contractSeasonsLeft = CONTRACT_MAX_SEASONS;
    }
  }

  // --- new blood: young prospects into the free-agent pool ---
  for (let i = 0; i < NEW_RIDERS_PER_SEASON; i++) {
    dynasty.roster.push(generateProspect(`fa-gen-${finishedSeason}-${i}`, rng));
  }

  // auto-fill any squad left below the minimum by retirements. Rivals grab the
  // best free agent going; the player gets a cheap stopgap call-up (flagged) so a
  // hole never breaks a race — they still sign properly in Team HQ.
  const autoSigned: string[] = [];
  for (const t of TEAMS) {
    while (squadSize(dynasty.roster, t.id) < MIN_SQUAD_SIZE) {
      const pool = dynasty.roster.filter((r) => r.teamId === null);
      if (pool.length === 0) break;
      pool.sort((a, b) => (t.id === playerId ? riderRating(a) - riderRating(b) : riderRating(b) - riderRating(a)));
      const pick = pool[0];
      assignToTeam(pick, t.id);
      if (t.id === playerId) autoSigned.push(pick.id);
    }
  }

  // cull the weakest spare free agents (by potential) so the market/save stays bounded
  const pool = dynasty.roster.filter((r) => r.teamId === null);
  if (pool.length > FREE_AGENT_POOL_CAP) {
    pool.sort((a, b) => scoutReport(a).ceiling - scoutReport(b).ceiling); // lowest potential first
    const cut = new Set(pool.slice(0, pool.length - FREE_AGENT_POOL_CAP).map((r) => r.id));
    dynasty.roster = dynasty.roster.filter((r) => !cut.has(r.id));
  }

  // winter rest: carry a heavily-recovered fatigue into the new season (survivors only)
  const live = new Set(dynasty.roster.map((r) => r.id));
  const carried = new Map<string, number>();
  for (const [id, fat] of dynasty.season.fatigue) if (live.has(id)) carried.set(id, fat * OFFSEASON_RECOVERY_RATE);

  dynasty.lastTeamRank = rank;
  dynasty.seasonNumber += 1;
  dynasty.season = createSeason(SEASON_CALENDAR);
  dynasty.season.fatigue = carried;
  dynasty.trainedThisGap = [];

  return {
    seasonNumber: finishedSeason,
    teamRank: rank[playerId],
    sponsor: playerSponsor,
    wages: playerWages,
    net: playerSponsor - playerWages,
    expiring,
    retired,
    retiredAll,
    emerged: NEW_RIDERS_PER_SEASON,
    autoSigned,
  };
}

/** A rider's current salary label (for UI). */
export function displaySalary(rider: Rider): number {
  return salaryOf(rider);
}

/**
 * Full tactics map for a stage using the **dynasty** squads: the player's role
 * sheet plus a default sheet for every rival, built from who's actually on each
 * team now (signed free agents included, released riders gone). The dynasty
 * equivalent of `raceSetup.buildTacticsMap` (which reads the static team lists).
 */
export function buildTacticsMapDyn(dynasty: DynastyState, stage: Stage, player: TeamTactics): Map<string, TeamTactics> {
  const map = new Map<string, TeamTactics>();
  map.set(player.teamId, player);
  for (const team of TEAMS) {
    if (team.id === player.teamId) continue;
    map.set(team.id, defaultTeamTacticsFor(team.id, teamRiders(dynasty, team.id), stage));
  }
  return map;
}
