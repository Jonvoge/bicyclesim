/**
 * Seedable RNG (SPEC — "keep the sim deterministic under a seed").
 *
 * mulberry32: tiny, fast, good-enough distribution for a game sim. Same seed →
 * same sequence, so race results are reproducible when tuning.
 */

export class Rng {
  private state: number;

  constructor(seed: number) {
    // force to uint32; avoid a zero state
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Normal-distributed draw via Box–Muller (SPEC §5.3). Math.random-style
   * uniforms are transformed into a bell curve so extreme days are rare but
   * possible — the "favourite can still lose" feel.
   */
  gaussian(mean = 0, sigma = 1): number {
    // avoid log(0)
    const u1 = this.next() || Number.EPSILON;
    const u2 = this.next();
    const mag = Math.sqrt(-2 * Math.log(u1));
    return mean + sigma * mag * Math.cos(2 * Math.PI * u2);
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Random element of an array. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
}
