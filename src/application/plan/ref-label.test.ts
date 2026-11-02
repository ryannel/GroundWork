import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { labelsOf, refLabel } from '@/application/plan/ref-label';
import { plainLine } from '@/application/plan-viz-text';

vi.mock(import('server-only'), () => ({}));
const { loadFixture } = await import('@/infrastructure/plan-fixture');

describe('reference labels', () => {
  it('turns unknown ids into words', () => {
    expect(refLabel('wi:pause-endpoint')).toBe('pause endpoint');
    expect(refLabel('flow:cancel#to-billing')).toBe('to billing');
    expect(refLabel('wi:other_thing', () => null)).toBe('other thing');
    expect(refLabel('wi:x', (id) => id)).toBe('x');
  });

  it('uses the supplied label', () => {
    expect(refLabel('wi:x', () => 'Ex')).toBe('Ex');
  });

  it('keeps two models isolated regardless of which was derived last', async () => {
    const plan = await loadFixture('mini.yaml');
    const first = derive(plan);
    const firstLabel = labelsOf(first);
    const second = derive({
      ...plan,
      teams: plan.teams.map((team) => ({ ...team, name: `Other ${team.name}` })),
    });
    expect(firstLabel('team:web')).toBe('Web');
    expect(labelsOf(second)('team:web')).toBe('Other Web');
    expect(plainLine('Ask [[team:web]]', first)).toBe('Ask Web');
    expect(plainLine('Ask [[team:web]]', second)).toBe('Ask Other Web');
    expect(refLabel('team:web')).toBe('web');
  });
});
