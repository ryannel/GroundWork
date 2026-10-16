// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { referenceOf } from './today-reference';

vi.mock('server-only', () => ({}));

describe('the reference of today', () => {
  it('lists only kinds with entries, components first, each in words', async () => {
    const { todayData } = await import('@/infrastructure/today-data');
    const data = await todayData('alder-finch');
    if (data === null) throw new Error('no alder-finch');
    const kinds = referenceOf(data.today.model);
    expect(kinds[0]?.kind).toBe('components');
    for (const entry of kinds) {
      expect(entry.count).toBeGreaterThan(0);
      expect(entry.size).toMatch(/^\w+ \w+/);
      expect(entry.headline).not.toBe('');
      expect(entry.headline).not.toMatch(/\bplan\b/i);
    }
  });
});
