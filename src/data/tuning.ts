/**
 * tuning.ts — every magic number lives here (SPEC §3, §10).
 *
 * ALL of these are STARTING GUESSES per SPEC §10. They can only be earned by
 * watching races once the headless sim (Phase 1) and race view (Phase 2) exist.
 * Do not treat any value here as settled. Balancing should be a one-file edit.
 *
 * Phase 0: declared as placeholders only. Nothing consumes them yet.
 */

// --- Daily form swing (SPEC §5.3) ---
export const SIGMA_MAX = 8;
export const CONSISTENCY_FACTOR = 0.7;

// --- Fatigue & recovery (SPEC §5.1, §5.8) ---
export const FATIGUE_WEIGHT = 0.9; // per-point penalty of currentFatigue on perfScore
export const STAMINA_FACTOR = 0.5; // how much stamina blunts across-stage fatigue gain
export const RECOVERY_RATE = 0.6; // currentFatigue *= this between races / on rest (season, Phase 4)

/**
 * Across-stage fatigue accrual within a tour (SPEC §5.8):
 *   fatigueGain = stageDifficulty · (1 − stamina/100 · STAMINA_FACTOR) · fatigueMult
 * where stageDifficulty = FATIGUE_BASE · TYPE_WEIGHT · (lengthKm / FATIGUE_REF_KM).
 * A mild overnight recovery between stages keeps a long tour from ballooning while
 * still letting hard days stack up. ALL starting guesses (SPEC §10) — the whole
 * point of Phase 3 is to watch a tour and see whether "spend today, pay tomorrow"
 * actually bites without wrecking a leader over ten days.
 */
export const FATIGUE_BASE = 3.4; // scales raw fatigue gain per stage
export const FATIGUE_REF_KM = 200; // a stage this long is "one unit" of length
export const STAGE_RECOVERY_RATE = 0.92; // currentFatigue *= this overnight between tour stages
export const STAGE_DIFFICULTY_BY_TYPE: Record<string, number> = {
  flat: 0.85,
  cobbled: 1.35,
  hilly: 1.15,
  descentFinish: 1.2,
  mountain: 1.5,
  summitFinish: 1.4,
};

// --- Rider roles (SPEC §5.5) — one role per rider, set before the stage ---
export const LEADER_BASE_BONUS = 4; // LEADER: perfScore bonus before any support
export const DOMESTIQUE_SUPPORT_BONUS = 1.2; // LEADER: extra bonus per DOMESTIQUE working for them…
export const DOMESTIQUE_SUPPORT_CAP = 4; // …counting at most this many domestiques
export const DOMESTIQUE_WORK_PENALTY = 2.5; // DOMESTIQUE: they work, they don't race for themselves
export const SPRINTER_BONUS = 5; // SPRINTER: bonus on likely bunch finishes
export const SPRINTER_CLIMB_PENALTY = 4; // SPRINTER: dropped when the road goes up
export const BREAK_PERF_BONUS = 3; // BREAKAWAY: bonus on break-friendly terrain
export const BREAK_TERRAIN_PENALTY = 2; // BREAKAWAY: penalty on bunch-sprint terrain (flat)
export const BREAK_SIGMA_MULT = 1.3; // BREAKAWAY: aggressive ride → wider form swing
// Fatigue accrual multipliers per role — consumed in Phase 3, exposed now.
export const ROLE_FATIGUE_LEADER = 1;
export const ROLE_FATIGUE_SPRINTER = 0.8; // sat in all day, saved it for the kick
export const ROLE_FATIGUE_BREAKAWAY = 1.2; // a day in the wind is expensive
export const ROLE_FATIGUE_DOMESTIQUE = 1.3; // riding on the front for the leader
export const ROLE_FATIGUE_FREE = 0.9;

// --- Team effort lever (SPEC §5.8, stage races) ---
// A team can "conserve for GC" on a stage: less fatigue burned across the whole
// team (fresher legs for the queen stage), paid for with a small perf penalty to
// the leader today. This is the giant-killing trade-off, reborn as an effort
// setting on top of the role sheet. Only meaningful in tours (a one-day race is
// always ridden flat-out).
export const CONSERVE_LEADER_PENALTY = 2; // perfScore penalty to a conserving team's leader
export const CONSERVE_FATIGUE_MULT = 0.45; // team-wide fatigue-gain multiplier when conserving

// --- Season points & standings (SPEC §6, Phase 4) ---
// Points a race awards its top finishers (one-day order or tour GC), scaled by
// the race's prestige/100. This is what a rider/team's season ranking sums.
export const SEASON_EVENT_POINTS = [100, 80, 65, 55, 48, 42, 38, 34, 30, 26, 22, 18, 14, 10, 6];

// --- Rival AI: season-aware resting (Phase 4 follow-up) ---
// Rival teams manage their squads like the player: they bench a rider who is
// both poorly suited to today's race (can't contest it) AND carrying real
// fatigue, to save them for races they suit. A rider whose suitability
// (baseScore ÷ the field's best for this terrain) is below the cap, once their
// season fatigue exceeds the floor, sits it out. Team leaders (suit ≈ 1) never
// rest; each team always keeps a minimum number of starters.
export const RIVAL_REST_SUIT_MAX = 0.82;
export const RIVAL_REST_FATIGUE_MIN = 6;
export const RIVAL_MIN_STARTERS = 3;

// --- Incidents: crashes & punctures (SPEC §5.6) ---
export const INCIDENT_PROB = 0.02; // per rider per stage (crash OR puncture)
export const INCIDENT_PROB_MULTIPLIER_RISKY = 2; // doubled on cobbled / descentFinish
export const PUNCTURE_SHARE = 0.6; // of incidents, this fraction are punctures (never DNF)
export const CRASH_DNF_FRACTION = 0.06; // of CRASHES only, this fraction abandon — rare
export const INCIDENT_TIME_LOSS_MIN = 20; // seconds lost (min)
export const INCIDENT_TIME_LOSS_MAX = 100; // seconds lost (max)

// --- Finish groups (SPEC §5.7) ---
export const GROUP_GAP_THRESHOLD_SEC = 5; // riders within this of the rider ahead share a group
export const GROUP_GAP_THRESHOLD_HARD_SEC = 2; // mountain/summit: field shatters into small groups

// The strongest FAVOURITE_COUNT riders are the "favourites": they never ride in
// the morning break — they save it and attack late (SPEC §5.9).
export const FAVOURITE_COUNT = 6;

// --- Race narrative: the morning breakaway (opportunists only) (SPEC §5.9) ---
export const BREAK_MIN_SIZE = 2; // riders up the road
export const BREAK_MAX_SIZE = 5;
export const BREAK_MAX_LEAD_SEC_MIN = 60; // peak lead the break builds mid-race (min)
export const BREAK_MAX_LEAD_SEC_MAX = 300; // peak lead the break builds mid-race (max)
export const BREAK_WIN_MARGIN_SEC = 14; // if it survives, how far clear it finishes

/**
 * Whether the morning break survives is emergent, not a flat dice roll (SPEC §5.9):
 *   survive = clamp(BASE + TERRAIN·friendliness + tacticBonus, 0, MAX)
 * The break is opportunists, so it lives or dies mostly on how break-friendly the
 * course is; committing riders to it (BREAKAWAY role on non-favourites) helps —
 * per committed rider in the break, capped.
 */
export const BREAK_SURVIVE_BASE = 0.05;
export const BREAK_SURVIVE_TERRAIN_W = 0.32;
export const BREAK_SURVIVE_TACTIC_BONUS = 0.16; // per committed rider in the break…
export const BREAK_SURVIVE_TACTIC_CAP = 0.28; // …but no more than this in total
export const BREAK_SURVIVE_MAX = 0.5;
// A break full of flat-road engines (rouleurs) rides faster and stays away more:
// the break's mean `flat` stat above/below this pivot nudges its survival odds.
export const BREAK_SURVIVE_FLAT_PIVOT = 62;
export const BREAK_SURVIVE_FLAT_W = 0.0055; // survival bonus per point of mean flat over the pivot
export const BREAK_SURVIVE_FLAT_CAP = 0.16; // bounded contribution (±)

/**
 * Late attack by a favourite in the finale (SPEC §5.9). Whether one is launched,
 * and whether it sticks, both scale with how selective the terrain is — attacks
 * win on climbs, get chased down on flat roads.
 *   P(attack)  = clamp(OCCUR_BASE + selectiveness·OCCUR_TERRAIN_W, 0, 1)   (1 if a
 *                team gave a favourite the BREAKAWAY role)
 *   P(sticks)  = clamp(SUCCESS_BASE + selectiveness·W + attackerStrength·W + tacticBonus, 0, MAX)
 */
export const LATE_ATTACK_OCCUR_BASE = 0.15;
export const LATE_ATTACK_OCCUR_TERRAIN_W = 0.5;
export const LATE_ATTACK_SUCCESS_BASE = 0.05;
export const LATE_ATTACK_SUCCESS_TERRAIN_W = 0.34;
export const LATE_ATTACK_SUCCESS_STRENGTH_W = 0.28;
export const LATE_ATTACK_SUCCESS_TACTIC_BONUS = 0.18;
export const LATE_ATTACK_SUCCESS_MAX = 0.7;
export const LATE_ATTACK_MARGIN_MIN = 5; // seconds a successful solo attack wins by
export const LATE_ATTACK_MARGIN_MAX = 24;

/** Terrain break-friendliness (0 = sprinters control, 1 = breaks thrive). */
export const BREAK_FRIENDLINESS: Record<string, number> = {
  flat: 0.12,
  summitFinish: 0.38,
  mountain: 0.5,
  cobbled: 0.52,
  descentFinish: 0.55,
  hilly: 0.6,
};

/** Terrain selectiveness for late attacks (climbs reward the attacker). */
export const TERRAIN_SELECTIVENESS: Record<string, number> = {
  flat: 0.12,
  cobbled: 0.4,
  descentFinish: 0.45,
  hilly: 0.55,
  mountain: 0.75,
  summitFinish: 0.85,
};

// Narrative timing is jittered per race so no two unfold identically (SPEC §5.9).
export const BREAK_PEAK_T_MIN = 0.32;
export const BREAK_PEAK_T_MAX = 0.46;
export const CATCH_T_MIN = 0.6;
export const CATCH_T_MAX = 0.92;
export const FINALE_T_MIN = 0.78;
export const FINALE_T_MAX = 0.93;

// --- Result → times (SPEC §5.7) ---
export const REFERENCE_SPEED_KMH = 42; // winner's average speed → base time
export const GAP_SPREAD = 1.5; // seconds of gap per point of perfScore difference

// --- Management layer: economy, contracts & training (SPEC §5-mgmt, Phase 5) ---
// All STARTING GUESSES (SPEC §10) — the balance pass is Phase 8. Money is one
// abstract currency ("credits", think €k). The loop: a season-start sponsor
// cheque + prize money as you race fund a wage bill you pay at season rollover;
// signing a free agent costs an upfront fee + adds their salary to that bill, so
// hoarding stars quietly bleeds you dry. See src/sim/management.ts.

// Rider valuation (src/sim/rating.ts): a single 0–100 "overall" prices a rider.
export const RATING_PEAK_W = 0.45; // weight on the rider's single best offensive stat
export const RATING_OFFENSE_W = 0.25; // weight on the mean of the offensive stats
export const RATING_ENDURANCE_W = 0.15;
export const RATING_STAMINA_W = 0.15;

// Salary curve: salary scales super-linearly with rating so stars cost a lot more
// than journeymen. salary = SALARY_MIN + ((rating−FLOOR)/(100−FLOOR))^CURVE · (MAX−MIN).
export const SALARY_MIN = 80;
export const SALARY_MAX = 650;
export const SALARY_FLOOR_RATING = 55; // below this a rider is ~minimum wage
export const SALARY_CURVE = 2; // >1 = stars disproportionately expensive
export const SIGNING_FEE_MULT = 1.5; // one-off signing fee = salary × this

// Team finances.
export const STARTING_BUDGET = 1600; // player team's opening cash
export const RIVAL_STARTING_BUDGET = 2600; // rivals run comfortable books (they auto-renew squads)
export const SPONSOR_BASE = 1300; // season-start cheque, before the ranking bonus
export const SPONSOR_RANK_BONUS = 130; // extra per place above last (numTeams − rank) × this
export const PRIZE_PER_POINT = 2.2; // event prize to a team = its finishers' points × prestige/100 × this

// Squad rules — the wage bill plus these bounds force real selection choices.
export const MIN_SQUAD_SIZE = 6; // can't release below this (need a squad to race)
export const MAX_SQUAD_SIZE = 9; // can't sign above this (no hoarding)

// Contracts: seasons remaining tick down at each rollover; a rider hitting 0
// leaves for the free-agent pool unless re-signed. Seeded deterministically.
export const CONTRACT_MIN_SEASONS = 1;
export const CONTRACT_MAX_SEASONS = 3;
export const OFFSEASON_RECOVERY_RATE = 0.2; // season fatigue × this over the winter (near-full rest)

// Training (src/sim/management.ts): between races, coach a rider to nudge one
// stat — but it tires them (energy is the limiter, SPEC-style trade-off), and a
// rider may train at most once per race gap. Gains shrink as the stat rises and
// stop at the soft cap (coaching can't build a superstar from nothing).
export const TRAIN_SOFT_CAP = 95; // a stat can't be trained past this
export const TRAIN_REF = 50; // gain is TRAIN_MAX_GAIN at/below this stat…
export const TRAIN_MAX_GAIN = 3; // …tapering linearly to 0 at the soft cap
export const TRAIN_MIN_GAIN = 0.4; // never award less than this (until the cap)
export const TRAIN_FATIGUE_COST = 2; // season fatigue added by one training session

/**
 * Terrain compresses (or spreads) the finishing field. On a flat day the whole
 * peloton rolls in together — a bunch sprint — so ability differences barely open
 * time gaps; on a summit finish the climbers ride everyone off their wheel and the
 * field shatters. This multiplies the perf-derived gap (SPEC §5.7): near-0 on flat
 * → one big same-time bunch, ~1 on a summit → the full spread. Real time losses
 * (crashes, a break's winning margin) are added separately and are NOT compressed.
 * A happy side effect: flat/rolling stages barely move GC, so the classification
 * is decided in the mountains — where fresh vs. tired legs matters most.
 */
export const GAP_COMPRESSION_BY_TYPE: Record<string, number> = {
  flat: 0.12,
  cobbled: 0.42,
  hilly: 0.5,
  descentFinish: 0.58,
  mountain: 0.85,
  summitFinish: 1.0,
};
