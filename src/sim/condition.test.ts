import { describe, expect, it } from 'vitest';

import { CONDITION_PERF_MAX } from '../data/tuning.ts';
import type { Rider, Stage, StatKey } from '../data/types.ts';
import { Rng } from './rng.ts';
import { scoreRiders, simulateStage } from './stageSim.ts';

/**
 * The Condition hook (Season Focus ext). A rider's planned form shifts the MEAN of
 * their day (a peak makes them stronger), on top of the daily form swing.
 */

function rider(id: string, climbing: number, condition?: number): Rider {
  const stats: Record<StatKey, number> = {
    climbing,
    flat: 50,
    sprint: 50,
    puncheur: 50,
    endurance: 60,
    stamina: 60,
    consistency: 70,
  };
  return { id, name: id, nationality: 'XX', age: 26, teamId: 'p', stats, currentFatigue: 0, condition };
}

const SUMMIT: Stage = { id: 's', name: 'Summit', type: 'summitFinish', lengthKm: 180 };

describe('condition affects perfScore', () => {
  it('a full peak scores exactly 2·CONDITION_PERF_MAX above a full trough (same seed)', () => {
    const peaked = scoreRiders({ stage: SUMMIT, riders: [rider('a', 80, 1)], tacticsByTeam: new Map(), rng: new Rng(42) });
    const troughed = scoreRiders({ stage: SUMMIT, riders: [rider('a', 80, 0)], tacticsByTeam: new Map(), rng: new Rng(42) });
    expect(peaked[0].perfScore - troughed[0].perfScore).toBeCloseTo(2 * CONDITION_PERF_MAX, 6);
  });

  it('an undefined condition is neutral — identical to condition 0.5', () => {
    const none = scoreRiders({ stage: SUMMIT, riders: [rider('a', 80, undefined)], tacticsByTeam: new Map(), rng: new Rng(7) });
    const neutral = scoreRiders({ stage: SUMMIT, riders: [rider('a', 80, 0.5)], tacticsByTeam: new Map(), rng: new Rng(7) });
    expect(none[0].perfScore).toBeCloseTo(neutral[0].perfScore, 6);
  });

  it('a peaked rider beats an equal, troughed rival far more often than not', () => {
    let peakWins = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const rng = new Rng(i * 2654435761 + 1);
      const result = simulateStage({
        stage: SUMMIT,
        riders: [rider('peak', 78, 1), rider('flat', 78, 0)],
        tacticsByTeam: new Map(),
        rng,
      });
      if (result.order[0].riderId === 'peak') peakWins++;
    }
    expect(peakWins / N).toBeGreaterThan(0.85); // form tips a coin-flip strongly, but not certainly
  });
});
