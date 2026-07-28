import { ALL_RIDERS } from '../data/freeAgents.ts';
import { conditionForEvent, defaultFocusPlanId, FOCUS_PLANS_BY_ID } from '../data/focusPlans.ts';
import { RACES_BY_ID, SEASON_CALENDAR } from '../data/races.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { teamColor, type TeamColor } from '../data/teamColors.ts';
import { TEAMS, PLAYER_TEAM } from '../data/teams.ts';
import type { GeneratedWorldDraft, Race, Stage, TeamIdentity, WorldState } from '../data/types.ts';
import { defaultTeamTacticsFor } from '../sim/raceSetup.ts';
import { baseScore } from '../sim/stageSim.ts';
import type { TeamTactics } from '../sim/tactics.ts';
import {
  CONTRACT_MAX_SEASONS,
  CONTRACT_MIN_SEASONS,
  FREE_AGENT_POOL_CAP,
  MIN_SQUAD_SIZE,
  NEW_RIDERS_PER_SEASON,
  OFFSEASON_RECOVERY_RATE,
  RACE_SQUAD_SIZE,
  RIVAL_STARTING_BUDGET,
  SQUAD_SELECTION_FATIGUE_WEIGHT,
  STARTING_BUDGET,
  TARGET_SQUAD_SIZE,
  TRAIN_CAMPS_PER_SEASON,
} from '../data/tuning.ts';
import type { Rider, StatKey } from '../data/types.ts';
import { ageOneSeason, generateDomestique, generateProspect, scoutReport, seedDevelopment, shouldRetire, trainingTick } from '../sim/development.ts';
import {
  canRelease,
  canSign,
  eventPrizeByTeam,
  salaryOf,
  sponsorIncome,
  squadSize,
  wageBill,
  type ActionCheck,
} from '../sim/management.ts';
import { objectiveForSeason, objectiveStatus } from '../sim/objectives.ts';
import { riderRating, riderSalary, signingFeeFor } from '../sim/rating.ts';
import { Rng } from '../sim/rng.ts';
import {
  createSeason,
  finishEvent,
  riderStandings,
  teamStandings,
  type SeasonResult,
  type SeasonState,
} from '../sim/season.ts';
import { createTour, type TourState } from '../sim/standings.ts';

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
  playerTeamId: string; // which of the 8 teams the player runs (chosen at new-dynasty)
  roster: Rider[]; // live clones of every rider; teamId = current team (null = free agent)
  budgets: Record<string, number>; // teamId → cash
  season: SeasonState; // the season currently being contested
  lastTeamRank: Record<string, number>; // teamId → last season's finishing rank (sponsor income)
  lastTraining: TrainingBlockSummary | null; // the most recent auto-training camp (for the UI); null between camps
  lastSettlement: EventSettlementSummary | null; // consequences of the most recently completed event
  seasonDev: Record<string, Partial<Record<StatKey, number>>>; // player riderId → stat points gained SO FAR this season (reset at rollover)
  world?: WorldState; // generated-world identity/division/history; absent on legacy authored saves
}

/** What one automatic training camp did to the player's squad (for the UI). */
export interface TrainingBlockSummary {
  afterEvent: number; // races completed in the season when this camp ran
  improvedCount: number; // player riders who gained at least a little
  totalGain: number; // total stat points added across the player's squad
  perRider: { id: string; gain: number; topStat?: StatKey }[]; // player squad gains this camp, biggest first (with the stat that moved most)
}

export interface EventSettlementSummary {
  result: SeasonResult;
  notablePlayerResults: { riderId: string; position: number }[];
  riderPointsGained: { riderId: string; points: number; rankBefore?: number; rankAfter?: number }[];
  teamPointsGained: number;
  teamRankBefore?: number;
  teamRankAfter?: number;
  prizeMoney: number;
  budgetBalance: number;
  objective: { text: string; before: number; current: number; target: number; completed: boolean };
  fatigue: { riderId: string; eventStart: number; eventEnd: number; recovered: number }[];
  training: TrainingBlockSummary | null;
  milestones: string[];
}

function cloneRider(r: Rider): Rider {
  return { ...r, stats: { ...r.stats }, ceiling: r.ceiling ? { ...r.ceiling } : undefined };
}

/** Deterministic 1..N contract length from a rider id (so a new game is reproducible). */
function seedContract(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  const span = CONTRACT_MAX_SEASONS - CONTRACT_MIN_SEASONS + 1;
  return CONTRACT_MIN_SEASONS + (h % span);
}

/** A fresh dynasty: clone the roster, price contracts, seed budgets and season 1. */
export function createDynasty(playerTeamId: string = PLAYER_TEAM.id): DynastyState {
  const roster = ALL_RIDERS.map(cloneRider);
  // pad every team to a rotatable depth with generated domestiques (Phase 8 pick-5)
  const gen = new Rng(0x5a1ad);
  for (const team of TEAMS) {
    let count = roster.filter((r) => r.teamId === team.id).length;
    for (let i = 0; count < TARGET_SQUAD_SIZE; i++, count++) {
      roster.push(generateDomestique(`${team.id}-dom${i}`, team.id, gen));
    }
  }
  for (const r of roster) {
    seedDevelopment(r); // hidden peakAge / ceiling / developmentRate (Phase 6)
    if (!r.focusPlanId) r.focusPlanId = defaultFocusPlanId(r); // season-long Condition plan (Season Focus ext)
    if (r.teamId) {
      r.salary = riderSalary(r);
      r.contractSeasonsLeft = seedContract(r.id);
    } else {
      r.salary = undefined;
      r.contractSeasonsLeft = undefined;
    }
  }
  const budgets: Record<string, number> = {};
  for (const t of TEAMS) budgets[t.id] = t.id === playerTeamId ? STARTING_BUDGET : RIVAL_STARTING_BUDGET;
  return {
    seasonNumber: 1,
    playerTeamId,
    roster,
    budgets,
    season: createSeason(SEASON_CALENDAR),
    lastTeamRank: {},
    lastTraining: null,
    lastSettlement: null,
    seasonDev: {},
  };
}

/** A fresh generated dynasty after one of the founding squad proposals is accepted. */
export function createGeneratedDynasty(draft: GeneratedWorldDraft): DynastyState {
  const playerTeam = draft.world.teams.find((team) => team.isPlayer);
  if (!playerTeam) throw new Error('Generated world has no player team');
  const roster = draft.riders.map(cloneRider);
  if (roster.filter((rider) => rider.teamId === playerTeam.id).length === 0) {
    throw new Error('Generated dynasty requires an accepted player squad');
  }
  for (const rider of roster) {
    if (!rider.focusPlanId) rider.focusPlanId = defaultFocusPlanId(rider);
  }
  const world: WorldState = {
    ...draft.world,
    teams: draft.world.teams.map((team) => ({ ...team })),
    teamSeasons: Object.fromEntries(Object.entries(draft.world.teamSeasons).map(([id, season]) => [id, { ...season }])),
    history: {
      seasons: [...draft.world.history.seasons],
      raceWinners: [...draft.world.history.raceWinners],
      promotions: [...draft.world.history.promotions],
      teamChampions: [...draft.world.history.teamChampions],
    },
  };
  return {
    seasonNumber: 1,
    playerTeamId: playerTeam.id,
    roster,
    budgets: {},
    season: createSeason(SEASON_CALENDAR),
    lastTeamRank: {},
    lastTraining: null,
    lastSettlement: null,
    seasonDev: {},
    world,
  };
}

// --- accessors (always read team membership through these) --------------------

export function dynastyTeams(dynasty: DynastyState): readonly { id: string; name: string }[] {
  return dynasty.world?.teams ?? TEAMS;
}

export function dynastyTeamIdentity(dynasty: DynastyState, teamId: string): TeamIdentity | undefined {
  return dynasty.world?.teams.find((team) => team.id === teamId);
}

export function dynastyTeamName(dynasty: DynastyState, teamId: string): string {
  return dynastyTeams(dynasty).find((team) => team.id === teamId)?.name ?? teamId;
}

export function dynastyTeamColor(dynasty: DynastyState, teamId: string | null): TeamColor {
  const identity = teamId ? dynastyTeamIdentity(dynasty, teamId) : undefined;
  return identity ? { jersey: identity.primaryColor, accent: identity.accentColor } : teamColor(teamId);
}

function teamBudget(dynasty: DynastyState, teamId: string): number {
  return dynasty.world?.teamSeasons[teamId]?.budget ?? dynasty.budgets[teamId] ?? 0;
}

function setTeamBudget(dynasty: DynastyState, teamId: string, budget: number): void {
  const generatedSeason = dynasty.world?.teamSeasons[teamId];
  if (generatedSeason) generatedSeason.budget = budget;
  else dynasty.budgets[teamId] = budget;
}

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
  return teamRiders(dynasty, dynasty.playerTeamId);
}

export function freeAgents(dynasty: DynastyState): Rider[] {
  return dynasty.roster.filter((r) => r.teamId === null);
}

/** The field for a race: every rider currently under contract (free agents sit out). */
export function racingRoster(dynasty: DynastyState): Rider[] {
  return dynasty.roster.filter((r) => r.teamId !== null);
}

export function playerBudget(dynasty: DynastyState): number {
  return teamBudget(dynasty, dynasty.playerTeamId);
}

export function playerWageBill(dynasty: DynastyState): number {
  return wageBill(dynasty.roster, dynasty.playerTeamId);
}

// --- transfers & training -----------------------------------------------------

/** Sign a free agent to a team (default: the player's), paying the signing fee. */
export function signRider(dynasty: DynastyState, riderId: string, teamId: string = dynasty.playerTeamId): ActionCheck {
  const rider = dynasty.roster.find((r) => r.id === riderId);
  if (!rider) return { ok: false, reason: 'Unknown rider' };
  if (rider.teamId !== null) return { ok: false, reason: 'Not a free agent' };
  const fee = signingFeeFor(riderRating(rider));
  const check = canSign(teamBudget(dynasty, teamId), squadSize(dynasty.roster, teamId), fee);
  if (!check.ok) return check;
  setTeamBudget(dynasty, teamId, teamBudget(dynasty, teamId) - fee);
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

/**
 * Set a rider's season Focus plan (Season Focus ext). Rejects an unknown plan id.
 * Takes effect from the next event opened (Condition is seeded at `startSeasonEvent`).
 */
export function setFocusPlan(dynasty: DynastyState, riderId: string, planId: string): ActionCheck {
  const rider = dynasty.roster.find((r) => r.id === riderId);
  if (!rider) return { ok: false, reason: 'Unknown rider' };
  if (!FOCUS_PLANS_BY_ID.has(planId)) return { ok: false, reason: 'Unknown plan' };
  rider.focusPlanId = planId;
  return { ok: true };
}

// --- auto-training (development you watch, not a chore) -----------------------

/**
 * Which completed-event counts trigger an automatic training camp, spread evenly
 * through the calendar (never on the opening or closing race). For the 14-race
 * season with 4 camps this is [3, 6, 8, 11].
 */
export function campEventIndices(calendarLength: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= TRAIN_CAMPS_PER_SEASON; i++) {
    out.push(Math.round((calendarLength * i) / (TRAIN_CAMPS_PER_SEASON + 1)));
  }
  return out;
}

/**
 * Run one training camp: develop **every contracted rider** (rivals too, so the
 * peloton keeps pace) a small step toward their ceiling via `trainingTick` — the
 * young and high-potential gain most, veterans nothing. Returns a summary of the
 * *player's* squad gains for the UI. No fatigue, no player input: it just happens.
 */
function runTrainingBlock(dynasty: DynastyState): TrainingBlockSummary {
  const perRider: { id: string; gain: number; topStat?: StatKey }[] = [];
  for (const r of dynasty.roster) {
    if (r.teamId === null) continue; // free agents have no coach; they develop at the rollover
    const gain = trainingTick(r);
    if (r.teamId !== dynasty.playerTeamId) continue;
    // the stat that moved most this camp (for the "camp moment" popup)
    const topStat = (Object.entries(gain.byStat) as [StatKey, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];
    perRider.push({ id: r.id, gain: gain.total, topStat });
    // accumulate the season-to-date development so the screen can show "+N this year"
    const acc = (dynasty.seasonDev[r.id] ??= {});
    for (const [k, d] of Object.entries(gain.byStat) as [StatKey, number][]) {
      acc[k] = Math.round(((acc[k] ?? 0) + d) * 10) / 10;
    }
  }
  perRider.sort((a, b) => b.gain - a.gain);
  const totalGain = Math.round(perRider.reduce((s, p) => s + p.gain, 0) * 10) / 10;
  return {
    afterEvent: dynasty.season.eventIndex,
    improvedCount: perRider.filter((p) => p.gain > 0).length,
    totalGain,
    perRider,
  };
}

/** Total stat points a player rider has gained so far this season (for the UI). */
export function seasonDevTotal(dynasty: DynastyState, riderId: string): number {
  const acc = dynasty.seasonDev[riderId];
  if (!acc) return 0;
  return Math.round(Object.values(acc).reduce((s, d) => s + (d ?? 0), 0) * 10) / 10;
}

/** The stat a player rider has developed most this season, if any (for the UI). */
export function seasonDevTopStat(dynasty: DynastyState, riderId: string): StatKey | undefined {
  const acc = dynasty.seasonDev[riderId];
  if (!acc) return undefined;
  return (Object.entries(acc) as [StatKey, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Number of different stats a player rider has improved this season (for the UI). */
export function seasonDevStatCount(dynasty: DynastyState, riderId: string): number {
  return Object.values(dynasty.seasonDev[riderId] ?? {}).filter((gain) => (gain ?? 0) > 0).length;
}

// --- event & season transitions ----------------------------------------------

/**
 * Finish a race event: bank it in the season (points + carried fatigue), pay out
 * prize money to teams, and — at the season's spaced-out camp milestones — run an
 * automatic training camp (stashed on `dynasty.lastTraining` for the UI). Wraps
 * `season.finishEvent` so the UI has one call. Pass the dynasty roster so team
 * membership/standings read the *current* squads.
 */
export function finishSeasonEvent(dynasty: DynastyState, tour: TourState): EventSettlementSummary {
  const playerId = dynasty.playerTeamId;
  const riderPointsBefore = new Map(dynasty.season.points);
  const riderRanksBefore = new Map(riderStandings(dynasty.season).map((row, index) => [row.id, index + 1]));
  const teamRowsBefore = teamStandings(dynasty.season, (id) => teamOf(dynasty, id));
  const teamPointsBefore = teamRowsBefore.find((row) => row.id === playerId)?.points ?? 0;
  const teamRankBefore = teamRowsBefore.findIndex((row) => row.id === playerId);
  const fatigueBefore = new Map(dynasty.season.fatigue);
  const objective = objectiveForSeason(dynasty.seasonNumber);
  const objectiveBefore = objectiveStatus(objective, dynasty.season, (id) => teamOf(dynasty, id) === playerId);
  const hadPlayerWin = dynasty.season.results.some((entry) => teamOf(dynasty, entry.winnerId) === playerId);
  const result = finishEvent(dynasty.season, tour, dynasty.roster);
  const race = RACES_BY_ID.get(result.raceId)!;
  const prize = eventPrizeByTeam(result.classification, race.prestige, (id) => teamOf(dynasty, id));
  for (const [teamId, cash] of prize) setTeamBudget(dynasty, teamId, teamBudget(dynasty, teamId) + cash);
  dynasty.lastTraining = campEventIndices(dynasty.season.calendar.length).includes(dynasty.season.eventIndex)
    ? runTrainingBlock(dynasty)
    : null;

  const riderRanksAfter = new Map(riderStandings(dynasty.season).map((row, index) => [row.id, index + 1]));
  const teamRowsAfter = teamStandings(dynasty.season, (id) => teamOf(dynasty, id));
  const teamPointsAfter = teamRowsAfter.find((row) => row.id === playerId)?.points ?? 0;
  const teamRankAfter = teamRowsAfter.findIndex((row) => row.id === playerId);
  const objectiveAfter = objectiveStatus(objective, dynasty.season, (id) => teamOf(dynasty, id) === playerId);
  const playerClassification = result.classification
    .map((row, index) => ({ riderId: row.riderId, position: index + 1 }))
    .filter((row) => teamOf(dynasty, row.riderId) === playerId);
  const notablePlayerResults = playerClassification.filter((row, index) => row.position <= 10 || index === 0);
  const riderPointsGained = playerRiders(dynasty)
    .map((rider) => ({
      riderId: rider.id,
      points: (dynasty.season.points.get(rider.id) ?? 0) - (riderPointsBefore.get(rider.id) ?? 0),
      rankBefore: riderRanksBefore.get(rider.id),
      rankAfter: riderRanksAfter.get(rider.id),
    }))
    .filter((row) => row.points > 0);
  const fatigue = playerRiders(dynasty).map((rider) => {
    const eventStart = fatigueBefore.get(rider.id) ?? 0;
    const eventEnd = dynasty.season.fatigue.get(rider.id) ?? 0;
    const beforeRecovery = tour.fatigue.get(rider.id) ?? eventStart;
    return { riderId: rider.id, eventStart, eventEnd, recovered: Math.max(0, beforeRecovery - eventEnd) };
  });
  const milestones: string[] = [];
  if (!hadPlayerWin && teamOf(dynasty, result.winnerId) === playerId) milestones.push('First team win');

  dynasty.lastSettlement = {
    result,
    notablePlayerResults,
    riderPointsGained,
    teamPointsGained: teamPointsAfter - teamPointsBefore,
    teamRankBefore: teamRankBefore >= 0 ? teamRankBefore + 1 : undefined,
    teamRankAfter: teamRankAfter >= 0 ? teamRankAfter + 1 : undefined,
    prizeMoney: prize.get(playerId) ?? 0,
    budgetBalance: playerBudget(dynasty),
    objective: {
      text: objective.text,
      before: objectiveBefore.current,
      current: objectiveAfter.current,
      target: objectiveAfter.target,
      completed: !objectiveBefore.met && objectiveAfter.met,
    },
    fatigue,
    training: dynasty.lastTraining,
    milestones,
  };
  return dynasty.lastSettlement;
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
  objectiveText: string; // the season's board goal
  objectiveMet: boolean; // did the player hit it?
  objectiveReward: number; // cash bonus paid if met (0 otherwise)
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
  const teams = dynastyTeams(dynasty);
  const numTeams = teams.length;
  const playerId = dynasty.playerTeamId;
  const finishedSeason = dynasty.seasonNumber;
  const rng = new Rng((0x5ea5000 ^ finishedSeason) >>> 0);

  // rank teams by the season just finished (unlisted teams share the last place)
  const standings = teamStandings(dynasty.season, (id) => teamOf(dynasty, id));
  const rank: Record<string, number> = {};
  standings.forEach((row, i) => (rank[row.id] = i + 1));
  for (const t of teams) if (rank[t.id] === undefined) rank[t.id] = numTeams;

  // settle finances for every team (on the squad that raced this season)
  for (const t of teams) {
    const income = sponsorIncome(dynasty.lastTeamRank[t.id], numTeams);
    setTeamBudget(dynasty, t.id, Math.round(teamBudget(dynasty, t.id) + income - wageBill(dynasty.roster, t.id)));
  }
  const playerSponsor = sponsorIncome(dynasty.lastTeamRank[playerId], numTeams);
  const playerWages = wageBill(dynasty.roster, playerId);

  // season objective (Part E): pay the sponsor's board-goal bonus if the player hit
  // it (checked on the season's squad, before the winter roster changes)
  const objective = objectiveForSeason(finishedSeason);
  const objStatus = objectiveStatus(objective, dynasty.season, (id) => teamOf(dynasty, id) === playerId);
  const objectiveReward = objStatus.met ? objective.reward : 0;
  if (objectiveReward > 0) setTeamBudget(dynasty, playerId, teamBudget(dynasty, playerId) + objectiveReward);

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
  for (const t of teams) {
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

  // every rider (new prospects included) carries a default season focus plan
  for (const r of dynasty.roster) if (!r.focusPlanId) r.focusPlanId = defaultFocusPlanId(r);

  // winter rest: carry a heavily-recovered fatigue into the new season (survivors only)
  const live = new Set(dynasty.roster.map((r) => r.id));
  const carried = new Map<string, number>();
  for (const [id, fat] of dynasty.season.fatigue) if (live.has(id)) carried.set(id, fat * OFFSEASON_RECOVERY_RATE);

  dynasty.lastTeamRank = rank;
  dynasty.seasonNumber += 1;
  dynasty.season = createSeason(SEASON_CALENDAR);
  dynasty.season.fatigue = carried;
  dynasty.lastTraining = null;
  dynasty.lastSettlement = null;
  dynasty.seasonDev = {}; // the new season's development starts from zero

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
    objectiveText: objective.text,
    objectiveMet: objStatus.met,
    objectiveReward,
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
  for (const team of dynastyTeams(dynasty)) {
    if (team.id === player.teamId) continue;
    map.set(team.id, defaultTeamTacticsFor(team.id, teamRiders(dynasty, team.id), stage));
  }
  return map;
}

/**
 * The N riders a team fields for a race (Phase 8 pick-5). Ranked by suitability
 * (a one-day: `baseScore` for the terrain; a tour: overall rating) **minus a
 * fatigue penalty**, so a tired star drops down the order and a fresher rider gets
 * the start — that's how rivals rotate a squad over a season (it replaces the old
 * rival-rest AI). Returns rider ids, best first.
 */
export function pickRaceSquad(
  riders: Rider[],
  stage: Stage,
  seasonFatigue: Map<string, number>,
  isTour: boolean,
  n: number = RACE_SQUAD_SIZE,
): string[] {
  return riders
    .map((r) => ({ id: r.id, score: (isTour ? riderRating(r) : baseScore(r, stage)) - (seasonFatigue.get(r.id) ?? 0) * SQUAD_SELECTION_FATIGUE_WEIGHT }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((s) => s.id);
}

/**
 * Open a race event with pick-5 squads: seed carried season fatigue for the whole
 * field, then set the starters to **each team's best 5** (rivals auto-picked; the
 * player's is a sensible default the PreRace screen lets them override). The
 * dynasty equivalent of `season.startEvent`.
 */
export function startSeasonEvent(dynasty: DynastyState, race: Race): TourState {
  const tour = createTour(race);
  tour.condition = new Map();
  for (const r of racingRoster(dynasty)) {
    tour.fatigue.set(r.id, dynasty.season.fatigue.get(r.id) ?? 0);
    // seed each rider's season Condition for this event from their focus plan
    tour.condition.set(r.id, conditionForEvent(r.focusPlanId, dynasty.season.eventIndex, dynasty.season.calendar.length));
  }
  const stage = STAGES_BY_ID.get(race.stageIds[0])!;
  const isTour = race.stageIds.length > 1;
  const starters = new Set<string>();
  for (const team of dynastyTeams(dynasty)) {
    for (const id of pickRaceSquad(teamRiders(dynasty, team.id), stage, dynasty.season.fatigue, isTour)) starters.add(id);
  }
  tour.starters = starters;
  return tour;
}
