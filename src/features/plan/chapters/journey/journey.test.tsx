// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { giftWrap } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { shopGraph } from '@/../test/fixtures/journeys-shop-graph';
import { planDataOf } from '@/../test/plan-kit';
import type { Model } from '@/application/plan/derive';
import type { Page } from '@/application/plan-pages';
import type { Plan } from '@/domain/plan/plan.generated';
import { bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { JourneyChapter } from '@/features/plan/chapters/journey/journey-chapter';
import { Pager } from '@/features/plan/pager.client';

vi.mock(import('server-only'), () => ({}));

// The walk reads the plan in the browser; here it is handed the model the page was built from.
const held = vi.hoisted(() => ({ model: Promise.resolve<Model | null>(null) }));
vi.mock(import('@/features/plan/plan-model'), async (original) => ({
  ...(await original()),
  pendingModel: () => ({ model: held.model }),
}));

const PLANS: Readonly<Record<string, () => Plan>> = {
  'gift-wrap': giftWrap,
  'pause-orders': pauseOrders,
  'order-event-v2': orderEventV2,
  shop: shopGraph,
};

const page = (title: string): Page => ({
  chapter: 'journey',
  screen: title,
  title,
  href: `/${title}/`,
});

function bodiesOf(plan: string) {
  const make = PLANS[plan];
  if (make === undefined) throw new Error(`no plan ${plan}`);
  return bodiesIn(planDataOf(make()), 'journey');
}

function screenOf(plan: string, key: string) {
  const bodies = bodiesOf(plan);
  const found = bodies.find((p) => p.page.screen === key);
  if (found === undefined) throw new Error(`no ${key}`);
  held.model = Promise.resolve(found.model);
  return found;
}

// The walk waits for the plan; inside an awaited act React draws it once the plan arrives.
async function draw(ui: ReactElement) {
  const drawn: ReturnType<typeof render>[] = [];
  const mount = () => {
    drawn.push(render(ui));
  };
  await act(async () => {
    mount();
    await Promise.resolve();
  });
  const [result] = drawn;
  if (result === undefined) throw new Error('not drawn');
  return result;
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 400 });
});
afterEach(cleanup);

describe('journey chapter', () => {
  it.each(Object.keys(PLANS))('draws every screen of %s with a headline', async (plan) => {
    for (const props of bodiesOf(plan)) {
      held.model = Promise.resolve(props.model);
      const { container, unmount } = await draw(<JourneyChapter {...props} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/\S/u);
      expect(container.textContent).not.toMatch(/undefined|\[object/u);
      unmount();
    }
  });

  it('says what the plan does to a flow, and walks it in both views', async () => {
    const { container } = await draw(
      <JourneyChapter {...screenOf('pause-orders', 'flow-place-order')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toBe(
      'Place an order: one step changes.',
    );
    const modes = await screen.findAllByRole('button', { name: 'With this plan' });
    expect(modes).toHaveLength(1);
  });

  it('walks a scenario one step at a time across its flows, in either view', async () => {
    const { container } = await draw(
      <JourneyChapter {...screenOf('gift-wrap', 'sc-birthday-gift')} />,
    );
    await expect(screen.findByText(/^Step 1 of \d+ in this scenario$/u)).resolves.toBeTruthy();
    const pick = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Flow in this scenario' });
    const first = pick.value;
    const next = () => container.querySelector<HTMLButtonElement>('[data-by="next"]');
    for (let i = 0; i < 60 && pick.value === first && next()?.disabled === false; i += 1) {
      const button = next();
      if (button !== null) fireEvent.click(button);
    }
    expect(pick.value).not.toBe(first);
    expect(globalThis.location.search).toContain('mode=today');
    fireEvent.click(screen.getByRole('button', { name: 'With this plan' }));
    expect(globalThis.location.search).toContain('mode=plan');
  });

  it('turns the pager into Next step and Previous step while the walk has steps', async () => {
    const neighbours = {
      previous: page('Before'),
      next: page('After'),
      previousChapter: null,
      nextChapter: null,
      opens: null,
      end: null,
    };
    await draw(
      <>
        <JourneyChapter {...screenOf('gift-wrap', 'sc-birthday-gift')} />
        <Pager neighbours={neighbours} />
      </>,
    );
    await expect(screen.findByText(/^Step 1 of \d+ in this scenario$/u)).resolves.toBeTruthy();
    const next = await screen.findByRole('button', { name: /next step/iu });
    expect(screen.getByRole('link', { name: /before/iu })).toBeTruthy();
    fireEvent.click(next);
    expect(screen.getByText(/^Step 2 of \d+ in this scenario$/u)).toBeTruthy();
    expect(screen.getByRole('button', { name: /previous step/iu })).toBeTruthy();
  });

  it('shows the flow picked from the scenario’s list', async () => {
    const { container } = await draw(
      <JourneyChapter {...screenOf('gift-wrap', 'sc-birthday-gift')} />,
    );
    fireEvent.change(await screen.findByRole('combobox', { name: 'Flow in this scenario' }), {
      target: { value: 'flow:wrap-order' },
    });
    expect(container.textContent).toContain('Wrap an order: new with this plan');
    expect(screen.getByRole('option', { name: 'Wrap an order · New' })).toBeTruthy();
  });

  it('gives a single flow no picker', async () => {
    await draw(<JourneyChapter {...screenOf('pause-orders', 'flow-place-order')} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('opens the planned scenario’s story under the headline', async () => {
    const { container } = await draw(
      <JourneyChapter {...screenOf('gift-wrap', 'sc-birthday-gift')} />,
    );
    expect(container.querySelector('details summary')?.textContent).toBe('A birthday present');
  });

  it('plays the plan out in paths, and links a step to the flow it cites', async () => {
    const { container } = await draw(<JourneyChapter {...screenOf('gift-wrap', 'execution')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^Wrapping is chosen once on the basket/u,
    );
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs).toContain('/acme/plans/gift-wrap/journey/sc-birthday-gift');
    expect(hrefs).toContain('/acme/plans/gift-wrap/journey/flow-publish-product');
  });

  it('steps through the operations behind the button', async () => {
    const { container } = await draw(<JourneyChapter {...screenOf('shop', 'behind')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^Showing the hero on the product page takes/u,
    );
    fireEvent.click(screen.getByRole('button', { name: /Stop 4 of/u }));
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/never cached/u);
    expect(container.textContent).toContain('If it is slow, call');
    expect(container.textContent).toContain('What purges the caches');
  });
});
