// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChangesChapter } from '@/features/plan/chapters/changes/changes-chapter';
import { PLANS, bodiesIn } from '@/features/plan/chapters/chapter-kit';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

const bodiesOf = async (plan: string) =>
  bodiesIn(await planData({ workspace: 'alder-finch', plan }), 'changes');

afterEach(cleanup);

describe('changes chapter', () => {
  it.each(PLANS)('draws every screen of %s with a headline', async (plan) => {
    for (const props of await bodiesOf(plan)) {
      const { container, unmount } = render(<ChangesChapter {...props} />);
      expect(
        container.querySelector('h1 + div, h2 + div')?.textContent ?? '',
        props.page.screen,
      ).not.toBe('');
      unmount();
    }
  });

  it('groups the records of a bigger plan and tabs the flows', async () => {
    const bodies = await bodiesOf('storefront-graph');
    const keys = bodies.map((b) => b.page.screen);
    expect(keys).toContain('ledger');
    const ledger = bodies.find((b) => b.page.screen === 'ledger');
    if (ledger === undefined) throw new Error('no ledger');
    const { container } = render(<ChangesChapter {...ledger} />);
    expect(container.textContent).toContain('By component');
  });

  it('has a graph screen only where the plan changes a graph', async () => {
    const bodies = await bodiesOf('storefront-graph');
    const graph = bodies.find((b) => b.page.screen === 'graph');
    if (graph === undefined) throw new Error('no graph screen');
    const { container } = render(<ChangesChapter {...graph} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent ?? '').toMatch(/\.$/u);
    expect(container.textContent).toContain('Operation');
    expect(container.textContent).toContain('Waterfalls: how each operation is answered');
    expect(container.querySelector('table')).not.toBeNull();
    for (const plan of ['delivery-promise', 'invoice-vat-number', 'stock-reservation']) {
      const others = await bodiesOf(plan);
      const keys = others.map((b) => b.page.screen);
      expect(keys, plan).not.toContain('graph');
    }
  });

  it('answers nothing for a screen the layout does not have', async () => {
    const [first] = await bodiesOf('stock-reservation');
    if (first === undefined) throw new Error('no screens');
    const { container } = render(
      <ChangesChapter {...first} page={{ ...first.page, screen: 'missing' }} />,
    );
    expect(container.textContent).toBe('');
  });
});
