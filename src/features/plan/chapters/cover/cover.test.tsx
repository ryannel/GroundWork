// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLANS, bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { CoverChapter } from '@/features/plan/chapters/cover/cover-chapter';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(globalThis.location.search),
  useRouter: () => ({ push: vi.fn() }),
}));

const { planData } = await import('@/infrastructure/plan-data');

const bodiesOf = async (plan: string) =>
  bodiesIn(await planData({ workspace: 'alder-finch', plan }), 'cover');

async function screenOf(plan: string, screen: string) {
  const bodies = await bodiesOf(plan);
  const found = bodies.find((p) => p.page.screen === screen);
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

beforeEach(() => {
  globalThis.history.replaceState(null, '', '/');
});
afterEach(cleanup);

describe('cover', () => {
  it.each(PLANS)('draws the cover and Your part of %s with a headline', async (plan) => {
    for (const props of await bodiesOf(plan)) {
      const { container, unmount } = render(<CoverChapter {...props} />);
      expect(container.querySelector('h1, h2')?.textContent, props.page.screen).not.toBe('');
      unmount();
    }
  });

  it('opens with the plan’s title and a door to each team’s part', async () => {
    const props = await screenOf('stock-reservation', 'cover');
    const { container } = render(<CoverChapter {...props} />);
    expect(container.textContent).toContain(props.model.plan.meta.title);
    expect(container.querySelector('a[href*="/cover/part?team="]')).not.toBeNull();
  });
});

describe('Your part', () => {
  it('lists the teams, one line each, for everyone', async () => {
    const props = await screenOf('delivery-promise', 'part');
    const { container } = render(<CoverChapter {...props} />);
    for (const team of props.model.plan.teams) {
      expect(container.textContent).toContain(props.model.label(team.id));
    }
  });

  it.each(PLANS)('draws the page of the lens team of %s', async (plan) => {
    const props = await screenOf(plan, 'part');
    for (const team of props.model.plan.teams) {
      globalThis.history.replaceState(null, '', `/?team=${team.id}`);
      const { container, unmount } = render(<CoverChapter {...props} />);
      expect(container.querySelector<HTMLElement>('[data-lens]')?.dataset.lens).toBe(team.id);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
      unmount();
    }
  });
});
