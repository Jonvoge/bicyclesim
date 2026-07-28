import { describe, expect, it } from 'vitest';

import { createRiderNameRegistry } from './riderNames.ts';

describe('rider name registry', () => {
  it('seeds first-name and multi-word surname usage from live names', () => {
    const registry = createRiderNameRegistry([
      'Jef Van Kassei',
      'Jef Vervaeke',
      'Staf Van Kassei',
    ]);

    expect(registry.has('@first:Jef:2')).toBe(true);
    expect(registry.has('@last:Van Kassei:2')).toBe(true);
    expect(registry.has('@first:Staf:1')).toBe(true);
    expect(registry.has('@last:Vervaeke:1')).toBe(true);
  });
});
