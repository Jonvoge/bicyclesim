import { LEGREAD_Z_FLYING, LEGREAD_Z_GOOD, LEGREAD_Z_HEAVY, LEGREAD_Z_OFF } from '../data/tuning.ts';

/**
 * Daily form reveal — "read the legs" (docs/cycling-sim-SEASON-FOCUS.md, Part B).
 * Turns the seeded daily form swing (SPEC §5.3) into a legible bucket, read
 * **relative to the rider's own spread** (a z-score), so "FLYING" means unusually
 * good for *that* rider rather than just re-reporting consistency. Pure/headless —
 * the sim emits the raw swing (`ScoredRider.formSwing`/`sigmaUsed`), this buckets
 * it, the UI renders the face. It only exists after the sim starts (tactics locked),
 * so it can never leak into the pre-race screen.
 */

export type LegRead = 'flying' | 'good' | 'normal' | 'heavy' | 'off';

export interface LegReadInfo {
  riderId: string;
  z: number; // form swing in units of the rider's own σ
  read: LegRead;
}

const LABELS: Record<LegRead, string> = {
  flying: 'FLYING!',
  good: 'Good legs',
  normal: 'Normal',
  heavy: 'Heavy legs',
  off: 'Off day',
};

const FACES: Record<LegRead, string> = {
  flying: '😤',
  good: '🙂',
  normal: '😐',
  heavy: '😟',
  off: '😫',
};

/** Bucket a z-score (formSwing / σ) into a leg-read. */
export function legReadForZ(z: number): LegRead {
  if (z >= LEGREAD_Z_FLYING) return 'flying';
  if (z >= LEGREAD_Z_GOOD) return 'good';
  if (z <= LEGREAD_Z_OFF) return 'off';
  if (z <= LEGREAD_Z_HEAVY) return 'heavy';
  return 'normal';
}

/** The leg-read for a rider's form draw (σ ≤ 0 → neutral). */
export function legReadFor(formSwing: number, sigmaUsed: number): LegReadInfo {
  const z = sigmaUsed > 0 ? formSwing / sigmaUsed : 0;
  return { riderId: '', z, read: legReadForZ(z) };
}

export function legReadLabel(read: LegRead): string {
  return LABELS[read];
}

export function legReadFace(read: LegRead): string {
  return FACES[read];
}

/** Whether a leg-read is a notable one (flying / off) — the ones worth a radio shout. */
export function isNotableLegRead(read: LegRead): boolean {
  return read === 'flying' || read === 'off';
}
