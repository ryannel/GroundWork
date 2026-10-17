// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { giftWrap } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { shopGraph } from '@/../test/fixtures/journeys-shop-graph';
import { planDataOf } from '@/../test/plan-kit';
import type { Plan } from '@/domain/plan/plan.generated';
import { bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { TodayChapter } from '@/features/plan/chapters/today/today-chapter';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const mini = await loadFixture('mini.yaml');

const PLANS: Readonly<Record<string, () => Plan>> = {
  'gift-wrap': giftWrap,
  'pause-orders': pauseOrders,
  'order-event-v2': orderEventV2,
  shop: shopGraph,
  mini: () => structuredClone(mini),
};

function bodiesOf(plan: string) {
  const make = PLANS[plan];
  if (make === undefined) throw new Error(`no plan ${plan}`);
  return bodiesIn(planDataOf(make()), 'today');
}

function screenOf(plan: string, key: string) {
  const all = bodiesOf(plan);
  const found = all.find((p) => p.page.screen === key);
  if (found === undefined) throw new Error(`no ${key}`);
  return found;
}

afterEach(cleanup);

describe('today chapter', () => {
  it.each(Object.keys(PLANS))('draws every screen of %s with a headline', (plan) => {
    for (const props of bodiesOf(plan)) {
      const { container, unmount } = render(<TodayChapter {...props} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/\S/u);
      expect(container.textContent).not.toMatch(/undefined|\[object/u);
      unmount();
    }
  });

  it('steps through the system map: owners, calls, events, data', () => {
    const { container } = render(<TodayChapter {...screenOf('mini', 'system')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^No one team runs most/u,
    );
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Stop 3 of 4: The events/u }));
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/is the hub/u);
    fireEvent.click(screen.getByRole('button', { name: /Stop 4 of 4/u }));
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/is shared/u);
    expect(container.textContent).toContain('also accessed by');
  });

  it('brings the lines forward at the stop that is about them', () => {
    render(<TodayChapter {...screenOf('mini', 'system')} />);
    fireEvent.click(screen.getByRole('button', { name: /Stop 2 of 4: The calls/u }));
    expect(screen.getByRole('button', { name: 'Calls', pressed: true })).toBeTruthy();
  });

  it('lists the teams that run systems, and those that run none', () => {
    const { container } = render(<TodayChapter {...screenOf('pause-orders', 'system')} />);
    expect(container.textContent).toContain('two components');
  });

  it('draws the graph in three stops', () => {
    const { container } = render(<TodayChapter {...screenOf('shop', 'graph')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /asks only the subgraphs/u,
    );
    fireEvent.click(screen.getByRole('button', { name: /Stop 3 of 3/u }));
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/caches/u);
  });

  it('names the words a plan adds, and keeps them out of the concepts', () => {
    const { container } = render(<TodayChapter {...screenOf('gift-wrap', 'domain')} />);
    expect(container.textContent).toContain('This plan adds two words');
    expect(container.textContent).toContain('you meet them in Journey.');
  });

  it('shows what people see today', () => {
    const { container } = render(<TodayChapter {...screenOf('gift-wrap', 'screens')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/\S/u);
  });
});
