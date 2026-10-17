// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { Dag } from '@/features/plan/viz/dag/dag';

afterEach(cleanup);

const load = () => modelOf(dispatchDate());

describe('the dependency graph', () => {
  it('draws a card for each work item and an arrow for each dependency', () => {
    const model = load();
    const { container } = render(<Dag model={model} />);
    const work = model.plan.work_items ?? [];
    expect(container.querySelectorAll('svg [data-inspect^="wi:"]')).toHaveLength(work.length);
    const deps = work.reduce((n, w) => n + (w.depends_on ?? []).length, 0);
    expect(container.querySelectorAll('path[data-kind]')).toHaveLength(
      deps + 3, // the arrow heads in the defs
    );
    expect(work).toHaveLength(6);
    expect(deps).toBe(6);
    expect(container.textContent).toContain('6 work items');
    expect(container.textContent).toContain('critical path');
  });

  it('says a plan with no work has no graph', () => {
    const model = load();
    const bare = modelOf({ ...model.plan, work_items: [] });
    const { container } = render(<Dag model={bare} />);
    expect(container.textContent).toContain('No work items');
  });

  it('puts the milestones in bands when asked', () => {
    const model = load();
    const { container } = render(<Dag byMilestone model={model} />);
    for (const ms of ['M1', 'M2', 'M3', 'M4']) expect(container.textContent).toContain(ms);
  });
});
