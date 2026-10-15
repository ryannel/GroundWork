// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { Dag } from '@/features/plan/viz/dag/dag';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function load(slug: string) {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', slug);
  return derive(loaded.plan!);
}

describe('the dependency graph', () => {
  it('draws a card for each work item and an arrow for each dependency', async () => {
    const model = await load('stock-reservation');
    const { container } = render(<Dag model={model} />);
    const work = model.plan.work_items ?? [];
    expect(container.querySelectorAll('svg [data-inspect^="wi:"]')).toHaveLength(work.length);
    const deps = work.reduce((n, w) => n + (w.depends_on ?? []).length, 0);
    expect(container.querySelectorAll('path[data-kind]')).toHaveLength(
      deps + 3, // the arrow heads in the defs
    );
    expect(container.textContent).toContain(`${String(work.length)} work items`);
    expect(container.textContent).toContain('critical path');
  });

  it('says a plan with no work has no graph', async () => {
    const model = await load('stock-reservation');
    const bare = derive({ ...model.plan, work_items: [] });
    const { container } = render(<Dag model={bare} />);
    expect(container.textContent).toContain('No work items');
  });

  it('puts the milestones in bands when asked', async () => {
    const model = await load('stock-reservation');
    const { container } = render(<Dag byMilestone model={model} />);
    expect(container.textContent).toContain('M1');
  });
});
