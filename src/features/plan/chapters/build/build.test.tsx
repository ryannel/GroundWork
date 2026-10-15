// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BuildChapter } from '@/features/plan/chapters/build/build-chapter';
import { PLANS, bodiesIn } from '@/features/plan/chapters/chapter-kit';

vi.mock('server-only', () => ({}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const { planData } = await import('@/infrastructure/plan-data');

async function screenOf(plan: string, screen: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  const found = bodiesIn(data, 'build').find((p) => p.page.screen === screen);
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

afterEach(cleanup);

describe('build chapter', () => {
  it.each(PLANS)('draws both screens of %s under a headline', async (plan) => {
    for (const screen of ['build-order', 'work-by-team']) {
      const { container, unmount } = render(<BuildChapter {...await screenOf(plan, screen)} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
      unmount();
    }
  });

  it('leads the order with the gate, then the waves and the graph', async () => {
    const { container } = render(
      <BuildChapter {...await screenOf('delivery-promise', 'build-order')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^M1 waits on Fulfilment’s/,
    );
    expect(container.textContent).toContain('First, once approved');
    expect(container.querySelector('details svg')).not.toBeNull();
    expect(container.textContent).toContain('Dependency graph, with the critical path');
  });

  it('folds the finished waves of a delivered plan', async () => {
    const { container } = render(
      <BuildChapter {...await screenOf('stock-reservation', 'build-order')} />,
    );
    expect(container.textContent).toContain('How it was built');
    expect(container.textContent).toContain('Wave 1 · done');
  });

  it('gives each team its work and the work as issues', async () => {
    const { container } = render(
      <BuildChapter {...await screenOf('delivery-promise', 'work-by-team')} />,
    );
    expect(container.querySelectorAll('section').length).toBeGreaterThanOrEqual(3);
    expect(container.textContent).toContain('Send to GitHub');
    expect(container.textContent).toContain('next item waits on');
  });
});
