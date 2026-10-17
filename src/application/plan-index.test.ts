import { describe, expect, it, vi } from 'vitest';

import type { Workspace } from '@/domain/workspace';

import { planRowOf, planRowsOf } from './plan-index';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const plan = await loadFixture('mini.yaml');

const system = (id: string, repo: string, components: string[]) => ({
  id,
  name: id,
  team: null,
  repos: [repo],
  components: components.map((c) => ({
    id: c,
    name: c,
    type: 'service' as const,
    tech: null,
    does: null,
    talksTo: [],
  })),
});

const workspace: Workspace = {
  id: 'shop',
  name: 'Shop',
  description: '',
  isPrivate: false,
  teams: [],
  actors: [],
  domains: [
    {
      id: 'sales',
      name: 'Sales',
      purpose: null,
      systems: [system('subs', 'acme/subs', ['svc:subs'])],
    },
    { id: 'stock', name: 'Stock', purpose: null, systems: [system('wms', 'acme/wms', [])] },
  ],
};

const at = (status: 'draft' | 'review' | 'approved' | 'committed') =>
  planRowOf(workspace, { slug: 'm', plan: { ...plan, meta: { ...plan.meta, status } }, status: {} })
    .stage;

const dated = (slug: string, title: string, date: string) => ({
  slug,
  plan: { ...plan, meta: { ...plan.meta, title, date } },
  status: {},
});

const closed = { 'wi:pause-endpoint': { state: 'closed' as const } };

describe('the plans index', () => {
  it('reads a plan as a row: where it lands, its stage and how far its work has got', () => {
    const row = planRowOf(workspace, { slug: 'mini', plan, status: closed });
    expect(row).toMatchObject({ id: 'mini', href: '/shop/plans/mini/', title: plan.meta.title });
    expect(row.domains).toEqual(['sales']);
    expect(row.done).toBe(1);
    expect(row.workItems).toBe((plan.work_items ?? []).length);
    expect(row.stage).toBe(row.done === row.workItems ? 'done' : 'delivery');
    expect(row.summary).not.toMatch(/\[\[/u);
  });

  it('reaches a domain through the repo its work goes to', () => {
    const items = (plan.work_items ?? []).map((item) => ({ ...item, repo: 'acme/wms' }));
    const row = planRowOf(workspace, {
      slug: 'm',
      plan: { ...plan, work_items: items },
      status: {},
    });
    expect(row.domains).toEqual(['sales', 'stock']);
  });

  it('takes the stage from the plan until its work starts', () => {
    expect(at('draft')).toBe('draft');
    expect(at('review')).toBe('review');
    expect(at('committed')).toBe('approved');
  });

  it('lists the newest first, then by title', () => {
    const rows = planRowsOf(workspace, [
      dated('a', 'Older', '2025-01-01'),
      dated('b', 'Zeta', '2026-01-01'),
      dated('c', 'Alpha', '2026-01-01'),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });
});
