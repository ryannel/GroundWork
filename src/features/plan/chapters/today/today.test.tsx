// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLANS, bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { TodayChapter } from '@/features/plan/chapters/today/today-chapter';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function bodiesOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  return bodiesIn(data, 'today');
}

async function screenOf(plan: string, screen: string) {
  const all = await bodiesOf(plan);
  const found = all.find((p) => p.page.screen === screen);
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

afterEach(cleanup);

describe('today chapter', () => {
  it.each(PLANS)('draws every screen of %s with a headline', async (plan) => {
    for (const props of await bodiesOf(plan)) {
      const { container, unmount } = render(<TodayChapter {...props} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/\S/u);
      expect(container.textContent).not.toMatch(/undefined|\[object/u);
      unmount();
    }
  });

  it('steps through the system map: owners, calls, events, data', async () => {
    const { container, getByRole } = render(
      <TodayChapter {...await screenOf('delivery-promise', 'system')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^No one team runs most/u,
    );
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
    fireEvent.click(getByRole('button', { name: /Stop 3 of 4: The events/u }));
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/is the hub/u);
    fireEvent.click(getByRole('button', { name: /Stop 4 of 4/u }));
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/is shared/u);
    expect(container.textContent).toContain('also accessed by');
  });

  it('brings the lines forward at the stop that is about them', async () => {
    const { getByRole } = render(
      <TodayChapter {...await screenOf('delivery-promise', 'system')} />,
    );
    fireEvent.click(getByRole('button', { name: /Stop 2 of 4: The calls/u }));
    expect(getByRole('button', { name: 'Calls', pressed: true })).toBeTruthy();
  });

  it('lists the teams that run systems, and those that run none', async () => {
    const { container } = render(
      <TodayChapter {...await screenOf('invoice-vat-number', 'system')} />,
    );
    expect(container.textContent).toContain('two components');
  });

  it('draws the graph in three stops', async () => {
    const { container, getByRole } = render(
      <TodayChapter {...await screenOf('storefront-graph', 'graph')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /asks only the subgraphs/u,
    );
    fireEvent.click(getByRole('button', { name: /Stop 3 of 3/u }));
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/caches/u);
  });

  it('names the words a plan adds, and keeps them out of the concepts', async () => {
    const { container } = render(
      <TodayChapter {...await screenOf('delivery-promise', 'domain')} />,
    );
    expect(container.textContent).toContain('This plan adds three words');
    expect(container.textContent).toContain('you meet them in Journey.');
  });

  it('shows what people see today', async () => {
    const { container } = render(
      <TodayChapter {...await screenOf('delivery-promise', 'screens')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/\S/u);
  });
});
