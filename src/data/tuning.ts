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

// --- Crashes / illness (SPEC §5.6) ---
export const CRASH_PROB = 0.015; // per rider per stage
export const CRASH_PROB_MULTIPLIER_RISKY = 2; // doubled on cobbled / descentFinish
export const CRASH_DNF_FRACTION = 0.1; // fraction of crashes that become a DNF
export const CRASH_TIME_LOSS_MIN = 25; // seconds lost in a crash/puncture (min)
export const CRASH_TIME_LOSS_MAX = 110; // seconds lost in a crash/puncture (max)

// --- Finish groups (SPEC §5.7) ---
export const GROUP_GAP_THRESHOLD_SEC = 5; // riders within this of the rider ahead share a group
export const GROUP_GAP_THRESHOLD_HARD_SEC = 2; // mountain/summit: field shatters into small groups
export const GROUP_GAP_THRESHOLD_ITT_SEC = 0.5; // itt/ttt: individual times

// --- Race narrative: breakaway (SPEC §5.9) ---
export const BREAK_MIN_SIZE = 2; // riders up the road
export const BREAK_MAX_SIZE = 4;
export const BREAK_SURVIVE_PROB = 0.1; // base chance the break stays away to the line
export const BREAK_SURVIVE_PROB_TACTIC = 0.32; // when the player committed a rider to the break
export const BREAK_MAX_LEAD_SEC_MIN = 90; // peak lead the break builds mid-race (min)
export const BREAK_MAX_LEAD_SEC_MAX = 240; // peak lead the break builds mid-race (max)
export const BREAK_WIN_MARGIN_SEC = 12; // if it survives, how far clear the break winner finishes

// --- Result → times (SPEC §5.7) ---
export const REFERENCE_SPEED_KMH = 42; // winner's average speed → base time
export const GAP_SPREAD = 1.5; // seconds of gap per point of perfScore difference
