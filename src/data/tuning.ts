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
export const FATIGUE_WEIGHT = 1; // per-point penalty of currentFatigue on perfScore
export const STAMINA_FACTOR = 0.7; // how much stamina blunts across-stage fatigue gain
export const RECOVERY_RATE = 0.6; // currentFatigue *= this between races / on rest

// --- Tactics (SPEC §5.5) ---
export const LEADER_BONUS = 6; // PROTECT_LEADER: perfScore bonus to protected rider
export const ALL_IN_HELPER_PENALTY = 2; // PROTECT_LEADER: helpers work, don't race for themselves
export const CONSERVE_PENALTY = 2; // CONSERVE: small perfScore penalty (protected rider)
export const BREAK_PERF_BONUS = 3; // BREAKAWAY: bonus to the break rider on break-friendly terrain
export const BREAK_TERRAIN_PENALTY = 2; // BREAKAWAY: penalty on bunch-sprint terrain (flat/itt)
export const BREAK_SIGMA_MULT = 1.3; // BREAKAWAY: aggressive ride → wider form swing
export const SPRINT_FINISH_BONUS = 5; // SPRINT_FINISH: bonus on likely bunch finishes
export const SPRINT_FINISH_CLIMB_PENALTY = 4; // SPRINT_FINISH: dropped when the road goes up
export const ROLE_MULTIPLIER_DEFAULT = 1; // normal fatigue accrual (Phase 3)
export const ROLE_MULTIPLIER_ALL_IN = 1.3; // helpers' fatigue multiplier when going all-in
export const ROLE_MULTIPLIER_SPRINT = 0.8; // team saves a little for the sprint
export const ROLE_MULTIPLIER_CONSERVE = 0.7; // helpers' fatigue multiplier when conserving

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
 * course is; committing a domestique to it (BREAKAWAY on a non-favourite) helps.
 */
export const BREAK_SURVIVE_BASE = 0.05;
export const BREAK_SURVIVE_TERRAIN_W = 0.32;
export const BREAK_SURVIVE_TACTIC_BONUS = 0.16;
export const BREAK_SURVIVE_MAX = 0.5;

/**
 * Late attack by a favourite in the finale (SPEC §5.9). Whether one is launched,
 * and whether it sticks, both scale with how selective the terrain is — attacks
 * win on climbs, get chased down on flat roads.
 *   P(attack)  = clamp(OCCUR_BASE + selectiveness·OCCUR_TERRAIN_W, 0, 1)   (1 if the
 *                player committed their leader via BREAKAWAY)
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
