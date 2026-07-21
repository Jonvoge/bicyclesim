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
export const LEADER_BONUS = 6; // ALL_IN_LEADER: perfScore bonus to protected rider
export const ALL_IN_HELPER_PENALTY = 2; // ALL_IN_LEADER: helpers work, don't race for themselves
export const CONSERVE_PENALTY = 2; // CONSERVE: small perfScore penalty (protected rider)
export const HUNT_STAGE_SIGMA_MULT = 1.25; // HUNT_STAGE: rides aggressively → wider form swing
export const ROLE_MULTIPLIER_DEFAULT = 1; // normal fatigue accrual (Phase 3)
export const ROLE_MULTIPLIER_ALL_IN = 1.3; // helpers' fatigue multiplier when going all-in
export const ROLE_MULTIPLIER_CONSERVE = 0.7; // helpers' fatigue multiplier when conserving

// --- Crashes / illness (SPEC §5.6) ---
export const CRASH_PROB = 0.015; // per rider per stage
export const CRASH_PROB_MULTIPLIER_RISKY = 2; // doubled on cobbled / descentFinish
export const CRASH_DNF_FRACTION = 0.1; // fraction of crashes that become a DNF

// --- Result → times (SPEC §5.7) ---
export const REFERENCE_SPEED_KMH = 42; // winner's average speed → base time
export const GAP_SPREAD = 1.5; // seconds of gap per point of perfScore difference
