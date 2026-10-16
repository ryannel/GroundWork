import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { flowEntriesOf } from './today-flow-list';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const shop = derive(await loadFixture('shop.yaml'));
const someFlow = shop.asIs.flows[0]!;
const focus = new Set([someFlow.steps[0]!.to]);

describe('flowEntriesOf', () => {
  const entries = flowEntriesOf(shop, { focus, hrefOf: (id) => `/f/${id}/` });

  it('keeps only the flows with a step in the focus, most steps there first', () => {
    expect(entries.map((e) => e.id)).toContain(someFlow.id);
    expect(entries.every((e) => e.here > 0)).toBe(true);
    expect(entries.map((e) => e.here)).toEqual(
      entries.map((e) => e.here).toSorted((a, b) => b - a),
    );
  });

  it('says where each comes in, and finds it by what it touches', () => {
    const found = entries.find((e) => e.id === someFlow.id)!;
    expect(found.entry).toBe(shop.label(someFlow.steps[0]!.to));
    expect(found.href).toBe(`/f/${someFlow.id}/`);
    expect(found.terms).toContain(found.entry.toLowerCase());
  });

  it('groups by whatever the caller names', () => {
    const grouped = flowEntriesOf(shop, { focus, hrefOf: (id) => id, groupOf: () => 'Shop' });
    expect(new Set(grouped.map((e) => e.entry))).toEqual(new Set(['Shop']));
  });
});
