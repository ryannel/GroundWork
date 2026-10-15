// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLANS, bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { WhyChapter } from '@/features/plan/chapters/why/why-chapter';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function screenOf(plan: string, screen: string) {
  const bodies = await bodiesOf(plan);
  const found = bodies.find((p) => p.page.screen === screen);
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

const bodiesOf = async (plan: string) =>
  bodiesIn(await planData({ workspace: 'alder-finch', plan }), 'why');

afterEach(cleanup);

describe('why chapter', () => {
  it.each(PLANS)('draws every screen of %s with a headline', async (plan) => {
    for (const props of await bodiesOf(plan)) {
      const { container, unmount } = render(<WhyChapter {...props} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
      unmount();
    }
  });

  it('puts the evidence under the problem headline', async () => {
    const { container } = render(
      <WhyChapter {...await screenOf('stock-reservation', 'problem')} />,
    );
    expect(container.textContent).toContain('The evidence');
    expect(container.textContent).toContain('1.8% of orders');
  });

  it('opens the promise with the first goal and the time budget', async () => {
    const { container } = render(
      <WhyChapter {...await screenOf('stock-reservation', 'promise')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^In .+, an order that is captured/,
    );
    expect(container.textContent).toContain('We also promise');
    expect(container.textContent).toContain('We won’t');
    expect(container.textContent).toContain('Time budget');
  });

  it('tells where the scenarios run', async () => {
    const { container } = render(
      <WhyChapter {...await screenOf('stock-reservation', 'scenarios')} />,
    );
    expect(container.querySelectorAll('article').length).toBeGreaterThan(0);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/flow/);
  });
});
