import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { refLabel, setRefLabel } from '@/application/plan/ref-label';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

describe('refLabel', () => {
  it('turns a slug into words when no plan knows the id', () => {
    setRefLabel(null);
    expect(refLabel('wi:pause-endpoint')).toBe('pause endpoint');
    expect(refLabel('flow:cancel#to-billing')).toBe('to billing');
  });

  it('asks the registered plan first', () => {
    setRefLabel((id) => (id === 'wi:x' ? 'Ex' : null));
    expect(refLabel('wi:x')).toBe('Ex');
    expect(refLabel('wi:other_thing')).toBe('other thing');
    setRefLabel(null);
  });

  it('derive registers the plan it works out', async () => {
    setRefLabel(null);
    derive(await loadFixture('mini.yaml'));
    expect(refLabel('team:web')).not.toContain(':');
    setRefLabel(null);
  });
});
