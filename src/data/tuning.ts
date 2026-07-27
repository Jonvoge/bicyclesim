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

// --- Season Focus / Condition (docs/cycling-sim-SEASON-FOCUS.md, Part A) ---
// A planned, season-long form curve layered on the daily swing (§5.3) and the
// career development (§7): a rider builds toward a peak for their target races and
// can't hold top form all year. `condition ∈ [0,1]`; CONDITION_NEUTRAL adds nothing
// to perfScore, a full peak adds CONDITION_PERF_MAX (on par with a LEADER bonus).
// Plans (src/data/focusPlans.ts) each spend a fixed FOCUS_BUDGET of hump-area, so a
// sharp single peak goes higher than a double and Steady never peaks. ALL STARTING
// GUESSES (SPEC §10) — CONDITION_PERF_MAX and the hump widths are the two most
// likely to need the playtest.
export const CONDITION_FLOOR = 0.35; // form when a rider is outside their planned window
export const CONDITION_NEUTRAL = 0.5; // the condition that adds nothing to perfScore (the curve's zero point)
export const CONDITION_PERF_MAX = 4; // perfScore lift at a full peak (condition = 1)
export const FOCUS_BUDGET = 0.062; // target hump-area per plan (the conservation law, Part A.3)
export const FOCUS_BUDGET_TOL = 0.03; // allowed area spread across plans (Steady sits a hair high)

// --- Daily form reveal / "read the legs" (docs/cycling-sim-SEASON-FOCUS.md, Part B) ---
// The daily form swing (§5.3) is revealed as a face at the gun (once tactics lock).
// Bucketed by z-score = formSwing / σ, so "FLYING" means unusually good FOR THAT
// RIDER — a metronome at +6 is a special day, a wildcard swings there routinely.
export const LEGREAD_Z_FLYING = 1.5; // z ≥ this → 😤 FLYING!
export const LEGREAD_Z_GOOD = 0.6; // z ≥ this → 🙂 Good legs
export const LEGREAD_Z_HEAVY = -0.6; // z ≤ this → 😟 Heavy legs
export const LEGREAD_Z_OFF = -1.5; // z ≤ this → 😫 Off day
export const LEGREAD_RADIO_Z = 1.8; // |z| ≥ this on a RIVAL surfaces a radio line (your own always do)

// A player rider winning a race at this Condition or higher "nailed the peak" — a
// celebration (Part E), the payoff for planning. Pure UI, no mechanical bonus.
export const PEAK_CELEBRATE_CONDITION = 0.78;

// --- Season objective: the sponsor's board goal (Part E) ---
// One goal a year, alternating, with a modest cash reward when met — direction
// without complexity, on top of the existing prestige/sponsor loop. STARTING GUESSES.
export const MONUMENT_PRESTIGE = 90; // a race this prestigious or above counts as a "Monument"
export const OBJECTIVE_WINS_TARGET = 3; // "win N races this season"
export const OBJECTIVE_WINS_REWARD = 300; // cash bonus for the wins goal
export const OBJECTIVE_MONUMENT_REWARD = 400; // cash bonus for the Monument goal

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
// Attack-crowd penalty (SPEC §5.5): sending riders up the road is a card with a
// cost. A team can commit a couple of free/attack riders effectively; beyond that
// they have no one to control the race, mark each other, and burn out. Each free
// rider past the limit docks perfScore from EVERY free rider on the team, so
// "everyone attacks" is a worse move than a focused one-or-two. STARTING GUESS §10.
export const FREE_COORDINATION_LIMIT = 2; // free riders a team can send up the road for free
export const FREE_CROWD_PENALTY = 2.4; // perfScore docked per over-committed free rider, to all of them
// Fatigue accrual multipliers per role — consumed in Phase 3, exposed now.
export const ROLE_FATIGUE_LEADER = 1;
export const ROLE_FATIGUE_SPRINTER = 0.8; // sat in all day, saved it for the kick
export const ROLE_FATIGUE_DOMESTIQUE = 1.3; // riding on the front for the leader
export const ROLE_FATIGUE_FREE = 1.1; // 'free/attack' (merged from breakaway) — an active day in the wind

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

// Rival squad selection: rivals pick their best RACE_SQUAD_SIZE per event by
// suitability minus a fatigue penalty (`dynasty.pickRaceSquad`), so a tired star
// drops out and a fresher rider starts — squad rotation falls out of the pick-5
// model, which replaced the old standalone rival-rest AI.

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
export const BREAK_MAX_PER_TEAM = 2; // the bunch won't tow one squad up the road — cap a team's break riders
export const BREAK_MAX_LEAD_SEC_MIN = 60; // peak lead the break builds mid-race (min)
export const BREAK_MAX_LEAD_SEC_MAX = 300; // peak lead the break builds mid-race (max)
export const BREAK_WIN_MARGIN_SEC = 40; // if it survives, how far clear it finishes (a real gap, not a photo)

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
export const LATE_ATTACK_MARGIN_MIN = 18; // seconds a successful solo attack wins by (before terrain scaling)
export const LATE_ATTACK_MARGIN_MAX = 75;

/**
 * How much time a DECISIVE move (surviving break / successful late attack) actually
 * gains, by terrain. This is what makes the *clock* reflect the road: a solo over
 * the top of a mountain nets real minutes, but the same move on a descent finish
 * nets only seconds — you cannot gain much time going downhill (a repeated
 * playtest note). Multiplies the break-win and late-attack margins. STARTING
 * GUESSES §10.
 */
export const WIN_MARGIN_BY_TYPE: Record<string, number> = {
  flat: 0.6,
  descentFinish: 0.45, // hard to gain time on a descent — a daring plunge nets seconds, not minutes
  cobbled: 0.9,
  hilly: 1.0,
  mountain: 1.35,
  summitFinish: 1.5,
};

/**
 * Terrain break-friendliness (0 = sprinters control, 1 = breaks thrive).
 * A big MOUNTAIN day is the classic break-wins terrain — the GC group marks
 * itself and lets the move go — so it's the friendliest. A SUMMIT FINISH stays
 * lower: the favourites want the stage win up the final climb, so the break is
 * caught more often (playtest note: mountain breaks felt like they never stuck).
 */
export const BREAK_FRIENDLINESS: Record<string, number> = {
  flat: 0.12,
  summitFinish: 0.38,
  cobbled: 0.52,
  descentFinish: 0.55,
  hilly: 0.6,
  mountain: 0.82,
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
export const GAP_SPREAD = 1.0; // seconds of gap per point of perfScore difference (× terrain, below)

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
export const SIGNING_FEE_MULT = 2.2; // one-off signing fee = salary × this (a star is a real commitment)

// Team finances. Tightened in the post-playtest pass — money was too loose (you
// could sign anyone). Now you start with roughly one modest signing's worth of
// cash and a mid-table team runs close to break-even, so a marquee signing means
// saving up and/or trimming the wage bill.
export const STARTING_BUDGET = 600; // player team's opening cash
export const RIVAL_STARTING_BUDGET = 2600; // rivals run comfortable books (they auto-manage squads)
export const SPONSOR_BASE = 1000; // season-start cheque, before the ranking bonus
export const SPONSOR_RANK_BONUS = 130; // extra per place above last (numTeams − rank) × this
export const PRIZE_PER_POINT = 1.0; // event prize to a team = its finishers' points × prestige/100 × this
// Tuned in the Phase 8 balance pass: prize + sponsor now sit near break-even against
// the wage bill for a mid-table team, so a surplus must be earned by racing well and
// the budget can't balloon — money keeps mattering across a long dynasty.

// Squad rules — the wage bill plus these bounds force real selection choices.
export const MIN_SQUAD_SIZE = 6; // can't release below this (need cover to rotate)
export const MAX_SQUAD_SIZE = 9; // can't sign above this (no hoarding)
export const TARGET_SQUAD_SIZE = 8; // every team is padded to this at dynasty start (depth to rotate)
export const RACE_SQUAD_SIZE = 5; // riders each team fields per race — you pick exactly this many

// Contracts: seasons remaining tick down at each rollover; a rider hitting 0
// leaves for the free-agent pool unless re-signed. Seeded deterministically.
export const CONTRACT_MIN_SEASONS = 1;
export const CONTRACT_MAX_SEASONS = 3;
export const OFFSEASON_RECOVERY_RATE = 0.2; // season fatigue × this over the winter (near-full rest)

// Auto-training (src/sim/development.ts `trainingTick`): development you WATCH,
// not a chore you click. A handful of "training camps" per season nudge each
// contracted rider's stats toward their hidden ceiling — bigger for the young,
// near-zero once past their peak (AGE), scaled by how much headroom they still
// have (POTENTIAL), and concentrated on their strongest stats so specialists
// sharpen (TYPE). Always ceiling-bounded: a camp brings a rider to the potential
// they already have sooner, never past it — and never tires them.
export const TRAIN_CAMPS_PER_SEASON = 4; // automatic development events per season
export const TRAIN_TICK_RATE = 0.1; // fraction of a focus stat's gap-to-ceiling closed per camp (at full youth)
export const TRAIN_OFFTYPE_WEIGHT = 0.35; // off-type stats develop this fraction as fast as the rider's signature stats
export const TRAIN_FOCUS_STATS = 2; // how many of a rider's top stats count as "their type"

// --- Rider development & dynasty (SPEC §7, Phase 6) ---
// Careers rise, plateau and fade on INDIVIDUAL curves. Each rider has a hidden
// peakAge, per-stat ceiling and developmentRate (seeded at dynasty start, or when
// a prospect is generated). Growth toward the ceiling until peak; a plateau
// through the good years; real decline only in the veteran years (early bloomers
// stagnate, they don't crash). See src/sim/development.ts. STARTING GUESSES §10.

// Seeding hidden potential (deterministic per rider id):
export const PEAK_AGE_MEAN = 27; // most riders peak late-20s…
export const PEAK_AGE_SIGMA = 2.6; // …but some peak ~22 and some ~32
export const PEAK_AGE_MIN = 22;
export const PEAK_AGE_MAX = 32;
export const CEILING_HEADROOM_MAX = 26; // most points a young rider can still add to a stat
export const CEILING_TALENT_MIN = 0.4; // per-rider talent scales the headroom…
export const CEILING_TALENT_MAX = 1; // …so some prospects are far more gifted than others
export const DEV_RATE_MIN = 0.22; // fraction of the gap-to-ceiling closed per pre-peak season
export const DEV_RATE_MAX = 0.42;

// The age curve (applied once per rider at each season rollover):
export const DECLINE_ABS_AGE = 31; // decline only begins in the veteran years (plateau until here)
export const DECLINE_BASE = 1.2; // stat points lost in the first declining season…
export const DECLINE_ACCEL = 0.55; // …plus this much more each further year (accelerating fade)
export const STAT_FLOOR = 25; // a stat never rots below this

// Retirement (checked at rollover, after ageing):
export const RETIRE_AGE_MIN = 33; // retirement odds start climbing here
export const RETIRE_ACCEL = 0.15; // P(retire) added per year past the min
export const RETIRE_AGE_MAX = 39; // everyone has hung up the wheels by here

// New blood each off-season — young prospects into the free-agent pool, replacing
// the retirees and keeping the peloton (and the scouting gamble) alive:
export const NEW_RIDERS_PER_SEASON = 7;
export const FREE_AGENT_POOL_CAP = 16; // keep the market (and the save) bounded: cull the weakest spares
export const PROSPECT_AGE_MIN = 19;
export const PROSPECT_AGE_MAX = 22;
export const PROSPECT_BASE_MIN = 42; // a prospect's non-signature stats start around here…
export const PROSPECT_BASE_MAX = 66;
export const PROSPECT_SIGNATURE_MIN = 60; // …their signature stat starts higher (raw talent showing)
export const PROSPECT_SIGNATURE_MAX = 82; // a few prospects reach elite ceilings, so the peloton's
// top tier is replenished as the authored stars retire (Phase 8 balance pass)

// Scouting fuzz — a young rider's shown potential is UNCERTAIN (the gamble). The
// scouted ceiling carries a seeded error that shrinks to nothing as the rider
// ages and proves it, so signing a teenager is a real bet, not a lookup.
export const SCOUT_NOISE_MAX = 13; // ± ceiling error for the youngest rider…
export const SCOUT_CERTAIN_AGE = 27; // …fading to 0 by this age

/**
 * Terrain multiplier on the perf-derived gap (SPEC §5.7) — the single biggest
 * lever on how a stage reads. On a flat day it's **tiny** (~0.18), so the whole
 * peloton rolls in on one time (a bunch sprint) and ability barely opens gaps; on
 * a **summit finish** it's large (~4.6), so the climbers ride the rest off their
 * wheel and the field shatters into **minutes** — a pure sprinter loses 3–4 min on
 * a real mountain, so he simply can't hang onto GC. Rolling/hilly days sit in
 * between (puncheurs + climbers gap the fast men). Real time losses (crashes, a
 * break's winning margin) are added separately and are NOT scaled.
 *
 * Because fatigue is a perfScore penalty (§5.1), this same lever is what makes
 * **tired legs lose real time in the mountains** — a rider carrying fatigue drops
 * time only where the terrain magnifies it, so the Conserve trade (fresher legs
 * for the queen stage) actually shows up on the clock. Rebalanced in the post-
 * playtest pass: mountains were far too gentle and sprinters clung to GC.
 */
export const GAP_COMPRESSION_BY_TYPE: Record<string, number> = {
  flat: 0.18,
  cobbled: 0.65,
  hilly: 1.5,
  // A descent finish is NOT a time-gaining day: the field regroups on the drop, so
  // it reads much more like a flat/cobbled bunch than a climb (playtest note — it
  // was spreading time almost like a hilly stage at 1.25).
  descentFinish: 0.45,
  mountain: 3.8,
  summitFinish: 4.6,
};
