import { describe, expect, it, vi } from 'vitest';

import type { Plan } from '@/domain/plan/plan.generated';
import type { Workspace } from '@/domain/workspace';

import { planRowOf, planRowsOf, STAGE_WORDS } from './plan-index';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const plan = await loadFixture('mini.yaml');

const workspace: Workspace = {
  id: 'shop',
  name: 'Shop',
  description: '',
  isPrivate: false,
  teams: [],
  actors: [],
  domains: [{ id: 'empty', name: 'Empty', purpose: null, systems: [] }],
};

/** mini.yaml with no status, no date and no work items. */
function bare(title: string): Plan {
  const meta = { ...plan.meta, title };
  delete meta.status;
  delete meta.date;
  const out = { ...plan, meta };
  delete out.work_items;
  return out;
}

describe('the plans index, for plans that say little', () => {
  it('calls a plan delivered once every work item is closed', () => {
    const status = Object.fromEntries(
      (plan.work_items ?? []).map((w) => [w.id, { state: 'closed' as const }]),
    );
    const row = planRowOf(workspace, { slug: 'mini', plan, status });
    expect(row.stage).toBe('done');
    expect(STAGE_WORDS[row.stage]).toBe('Delivered');
    expect(row.done).toBe(row.workItems);
  });

  it('reads a plan with no status, date or work as an undated draft that lands nowhere', () => {
    const row = planRowOf(workspace, { slug: 'b', plan: bare('Bare'), status: {} });
    expect(row).toMatchObject({
      stage: 'draft',
      date: null,
      domains: [],
      workItems: 0,
      done: 0,
    });
  });

  it('puts dated plans before undated ones, and undated ones by title', () => {
    const rows = planRowsOf(workspace, [
      { slug: 'z', plan: bare('Zulu'), status: {} },
      { slug: 'mini', plan, status: {} },
      { slug: 'a', plan: bare('Alpha'), status: {} },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['mini', 'a', 'z']);
  });
});
