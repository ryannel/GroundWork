// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';

import { referenceOf } from './today-reference';

describe('the reference of today', () => {
  it('lists only kinds with entries, components first, each in words', () => {
    const kinds = referenceOf(acme().today.model);
    expect(kinds.map((entry) => [entry.kind, entry.count])).toEqual([
      ['components', 13],
      ['stores', 6],
      ['apis', 8],
      ['schemas', 5],
      ['events', 2],
      ['flows', 3],
      ['screens', 3],
    ]);
    expect(kinds[0]?.kind).toBe('components');
    for (const entry of kinds) {
      expect(entry.count).toBeGreaterThan(0);
      expect(entry.size).toMatch(/^\w+ \w+/u);
      expect(entry.headline).not.toBe('');
      expect(entry.headline).not.toMatch(/\bplan\b/iu);
    }
  });
});
