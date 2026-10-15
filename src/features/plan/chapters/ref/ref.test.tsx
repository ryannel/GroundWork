// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLANS, bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { RefChapter } from '@/features/plan/chapters/ref/ref-chapter';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(globalThis.location.search),
}));

const { planData } = await import('@/infrastructure/plan-data');

const bodiesOf = async (plan: string) =>
  bodiesIn(await planData({ workspace: 'alder-finch', plan }), 'ref');

async function screenOf(plan: string, screen: string) {
  const bodies = await bodiesOf(plan);
  const found = bodies.find((p) => p.page.screen === screen);
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

afterEach(cleanup);

describe('reference chapter', () => {
  it.each(PLANS)('draws every catalogue of %s with a headline', async (plan) => {
    for (const props of await bodiesOf(plan)) {
      const { container, unmount } = render(<RefChapter {...props} />);
      expect(
        container.querySelector('h1 + div, h2 + div')?.textContent,
        props.page.screen,
      ).not.toBe('');
      unmount();
    }
  });

  it('lists a catalogue for every reference screen', async () => {
    const bodies = await bodiesOf('delivery-promise');
    const screens = bodies.map((p) => p.page.screen);
    expect(screens).toEqual(expect.arrayContaining(['services', 'stores', 'apis', 'decisions']));
  });

  it('filters services by what is typed', async () => {
    const { container, getByRole } = render(
      <RefChapter {...await screenOf('delivery-promise', 'services')} />,
    );
    const rows = [...container.querySelectorAll<HTMLElement>('[data-search]')];
    expect(rows.length).toBeGreaterThan(1);
    const word = rows[0]?.dataset.search?.split(' ')[0] ?? '';
    await act(async () => {
      fireEvent.change(getByRole('searchbox'), { target: { value: `${word} zzzz-nothing` } });
      await Promise.resolve();
    });
    expect(rows.every((r) => r.hidden === true)).toBe(true);
    expect(container.textContent).toContain('Nothing matches that filter.');
  });
});
