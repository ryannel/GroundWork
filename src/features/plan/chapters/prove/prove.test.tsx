// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLANS, bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { ProveChapter } from '@/features/plan/chapters/prove/prove-chapter';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

const bodiesOf = async (plan: string) =>
  bodiesIn(await planData({ workspace: 'alder-finch', plan }), 'prove');

async function screenOf(plan: string, screen: string) {
  const bodies = await bodiesOf(plan);
  const found = bodies.find((p) => p.page.screen === screen);
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

afterEach(cleanup);

describe('prove chapter', () => {
  it.each(PLANS)('draws every screen of %s with a headline', async (plan) => {
    for (const props of await bodiesOf(plan)) {
      const { container, unmount } = render(<ProveChapter {...props} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
      unmount();
    }
  });

  it('says which flows no end-to-end test covers, and folds the brackets', async () => {
    const { container } = render(<ProveChapter {...await screenOf('stock-reservation', 'e2e')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toBe(
      'No end-to-end test covers “Allocate the order”.',
    );
    expect(container.textContent).toContain('Not covered end to end');
    expect(container.querySelectorAll('details').length).toBeGreaterThan(0);
    expect(container.querySelector('details[open]')).not.toBeNull();
  });

  it('names the unit-only change above the matrix, with the flows behind the e2e counts', async () => {
    const { container } = render(
      <ProveChapter {...await screenOf('delivery-promise', 'coverage')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toBe(
      'Every change has a test, but one has unit tests only.',
    );
    expect(container.textContent).toContain('Unit tests only:');
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });

  it('says the contract gap on the contracts screen', async () => {
    const { container } = render(
      <ProveChapter {...await screenOf('storefront-graph', 'contracts')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /has no contract test\.$/,
    );
  });

  it('puts the chapter claim on the first screen only', async () => {
    const bodies = await bodiesOf('stock-reservation');
    const first = render(<ProveChapter {...bodies[0]!} />);
    expect(first.container.textContent).toContain('A race test, a WMS-outage test');
    first.unmount();
    const later = render(<ProveChapter {...bodies[1]!} />);
    expect(later.container.textContent).not.toContain('A race test, a WMS-outage test');
  });
});
