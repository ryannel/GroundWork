// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { PLANS, bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { JourneyChapter } from '@/features/plan/chapters/journey/journey-chapter';

vi.mock('server-only', () => ({}));

// The walk reads the plan in the browser; here it is handed the model the page was built from.
const held = vi.hoisted(() => ({ model: Promise.resolve<unknown>(null) }));
vi.mock('@/features/plan/plan-model', async (original) => ({
  ...(await original<object>()),
  pendingModel: () => ({ model: held.model }),
}));

const { planData } = await import('@/infrastructure/plan-data');

async function bodiesOf(plan: string) {
  return bodiesIn(await planData({ workspace: 'alder-finch', plan }), 'journey');
}

async function screenOf(plan: string, key: string) {
  const bodies = await bodiesOf(plan);
  const found = bodies.find((p) => p.page.screen === key);
  if (found === undefined) throw new Error(`no ${key}`);
  held.model = Promise.resolve(found.model);
  return found;
}

// The walk waits for the plan; inside an awaited act React draws it once the plan arrives.
async function draw(ui: ReactElement) {
  let drawn: ReturnType<typeof render> | undefined;
  await act(async () => {
    drawn = render(ui);
    await Promise.resolve();
  });
  if (drawn === undefined) throw new Error('not drawn');
  return drawn;
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 400 });
});
afterEach(cleanup);

describe('journey chapter', () => {
  it.each(PLANS)('draws every screen of %s with a headline', async (plan) => {
    for (const props of await bodiesOf(plan)) {
      held.model = Promise.resolve(props.model);
      const { container, unmount } = await draw(<JourneyChapter {...props} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/\S/u);
      expect(container.textContent).not.toMatch(/undefined|\[object/u);
      unmount();
    }
  });

  it('says what the plan does to a flow, and walks it in both views', async () => {
    const { container } = await draw(
      <JourneyChapter {...await screenOf('stock-reservation', 'flow-allocate')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toBe(
      'Allocate the order: two steps change.',
    );
    const modes = await screen.findAllByRole('button', { name: 'With this plan' });
    expect(modes).toHaveLength(1);
  });

  it('walks a scenario one step at a time across its flows, in either view', async () => {
    const { container } = await draw(
      <JourneyChapter {...await screenOf('stock-reservation', 'sc-last-tent')} />,
    );
    expect(await screen.findByText(/^Step 1 of \d+ in this scenario$/u)).toBeTruthy();
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

  it('shows the flow picked from the scenario’s list', async () => {
    const { container } = await draw(
      <JourneyChapter {...await screenOf('stock-reservation', 'sc-last-tent')} />,
    );
    fireEvent.change(await screen.findByRole('combobox', { name: 'Flow in this scenario' }), {
      target: { value: 'flow:expire-reservation' },
    });
    expect(container.textContent).toContain('Expire a reservation: new with this plan');
    expect(screen.getByRole('option', { name: 'Expire a reservation · New' })).toBeTruthy();
  });

  it('gives a single flow no picker', async () => {
    await draw(<JourneyChapter {...await screenOf('stock-reservation', 'flow-allocate')} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('opens the planned scenario’s story under the headline', async () => {
    const { container } = await draw(
      <JourneyChapter {...await screenOf('stock-reservation', 'sc-last-tent')} />,
    );
    expect(container.querySelector('details summary')?.textContent).toBe('Two shoppers, one tent');
  });

  it('plays the plan out in paths, and links a step to the flow it cites', async () => {
    const { container } = await draw(
      <JourneyChapter {...await screenOf('delivery-promise', 'execution')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^One promise, created once/u,
    );
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.startsWith('/alder-finch/plans/delivery-promise/journey/'))).toBe(
      true,
    );
  });

  it('steps through the operations behind the button', async () => {
    const { container } = await draw(
      <JourneyChapter {...await screenOf('storefront-graph', 'behind')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^Showing the product page takes/u,
    );
    fireEvent.click(screen.getByRole('button', { name: /Stop 3 of/u }));
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/never cached/u);
    expect(container.textContent).toContain('If it is slow, call');
    expect(container.textContent).toContain('What purges the caches');
  });
});
