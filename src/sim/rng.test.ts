import { describe, expect, it } from 'vitest';

import { deriveSeed, Rng } from './rng.ts';

describe('derived deterministic RNG streams', () => {
  it('replays the same stream from the same root seed and path', () => {
    const first = new Rng(deriveSeed(2026, 'roster', 'pro', 3));
    const second = new Rng(deriveSeed(2026, 'roster', 'pro', 3));
    expect([first.next(), first.next(), first.next()]).toEqual([second.next(), second.next(), second.next()]);
  });

  it('isolates unrelated generation streams', () => {
    expect(deriveSeed(2026, 'identity')).not.toBe(deriveSeed(2026, 'roster'));
    expect(deriveSeed(2026, 'season', 1, 'development')).not.toBe(deriveSeed(2026, 'season', 1, 'race'));
  });
});