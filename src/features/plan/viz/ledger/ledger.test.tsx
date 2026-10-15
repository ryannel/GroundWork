// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { HealthStrip } from '@/features/plan/viz/ledger/health-strip';
import { Ledger } from '@/features/plan/viz/ledger/ledger';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function load(slug = 'delivery-promise') {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', slug);
  return derive(loaded.plan!);
}

describe('ledger', () => {
  it('draws one expandable row per change, grouped by service', async () => {
    const model = await load();
    const { container } = render(<Ledger model={model} />);
    expect(container.querySelectorAll('details[data-change]')).toHaveLength(
      model.plan.changes!.length,
    );
    expect(container.querySelectorAll('section').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('open a row for details');
    expect(container.textContent).toContain('What it does');
    expect(container.querySelector('button[data-inspect^="chg:"]')?.textContent).toBe(
      'Open the change',
    );
  });

  it('opens the rows it is told to and can drop the key and the groups', async () => {
    const model = await load();
    const id = model.plan.changes![0]!.id;
    const { container } = render(
      <Ledger groupBy="none" legend={false} model={model} open={[id]} />,
    );
    expect(container.querySelector(`details[data-change="${id}"]`)?.hasAttribute('open')).toBe(
      true,
    );
    expect(container.querySelector('section header')).toBeNull();
    expect(container.textContent).not.toContain('open a row for details');
  });

  it('groups by team and says when a team has no changes', async () => {
    const model = await load();
    const byTeam = render(<Ledger groupBy="team" model={model} />);
    expect(byTeam.container.querySelector('header [data-inspect^="team:"]')).not.toBeNull();
    byTeam.unmount();
    const none = render(<Ledger lens="team:nobody" model={model} />);
    expect(none.container.textContent).toBe('No changes for this team.');
  });
});

describe('health strip', () => {
  it('shows the counts with their meaning', async () => {
    const model = await load();
    const { container } = render(<HealthStrip model={model} />);
    expect(container.querySelectorAll('li')).toHaveLength(7);
    expect(container.textContent).toContain('planned edits to the system');
    const some = render(<HealthStrip keys={['tests']} model={model} />);
    expect(some.container.querySelectorAll('li')).toHaveLength(1);
  });
});
