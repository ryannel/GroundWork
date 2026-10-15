// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLANS, bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { CommitChapter } from '@/features/plan/chapters/commit/commit-chapter';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function screens(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  return bodiesIn(data, 'commit');
}

async function screenOf(plan: string, screen: string) {
  const list = await screens(plan);
  const found = list.find((p) => p.page.screen === screen);
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

afterEach(cleanup);

describe('commit chapter', () => {
  it.each(PLANS)('draws every screen of %s under a headline', async (plan) => {
    const list = await screens(plan);
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const body of list) {
      const { container, unmount } = render(<CommitChapter {...body} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
      unmount();
    }
  });

  it('groups the proposed choices apart from the accepted ones', async () => {
    const { container } = render(
      <CommitChapter {...await screenOf('delivery-promise', 'choices')} />,
    );
    const heads = [...container.querySelectorAll('h3')].map((h) => h.textContent);
    expect(heads).toContain('Proposed');
    expect(heads).toContain('Accepted');
    expect(container.querySelectorAll('article').length).toBeGreaterThan(3);
  });

  it('places the risks in a grid and gives each a card', async () => {
    const { container } = render(
      <CommitChapter {...await screenOf('delivery-promise', 'risks')} />,
    );
    expect(container.querySelector('figure')).not.toBeNull();
    expect(container.querySelectorAll('article')).toHaveLength(8);
    expect(container.textContent).toContain('Mitigation');
  });

  it('folds the rest of the register by kind', async () => {
    const { container } = render(
      <CommitChapter {...await screenOf('delivery-promise', 'register')} />,
    );
    expect(container.querySelectorAll('details').length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain('Kept here for the record.');
  });

  it('owes the answers by team, with the rule, before approval', async () => {
    const { container } = render(<CommitChapter {...await screenOf('storefront-graph', 'ask')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /owe five answers and one decision/,
    );
    expect(container.textContent).toContain('if nobody decides');
    expect(container.textContent).toContain('waiting on this');
    expect(container.textContent).toContain('What do the ratings do?');
    expect(container.textContent).toContain('Below 3, the plan is rethought.');
    expect(container.textContent).toContain('The plan’s owner approves');
  });

  it('puts the low rating first when a team is not confident', async () => {
    const { container } = render(<CommitChapter {...await screenOf('delivery-promise', 'ask')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^Legal is not confident/,
    );
    expect(container.textContent).toContain('Confidence ratings');
    expect(container.textContent).toContain('Also open:');
    expect(container.textContent).not.toContain('Below 3, the plan is rethought.');
  });

  it('says only what is open once the plan is approved', async () => {
    const { container } = render(
      <CommitChapter {...await screenOf('invoice-vat-number', 'ask')} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toBe('Approved 25 Sep.');
    expect(container.textContent).not.toContain('What do the ratings do?');
  });

  it('folds the ratings of a delivered plan', async () => {
    const { container } = render(<CommitChapter {...await screenOf('stock-reservation', 'ask')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toBe('Delivered 27 Aug.');
    expect(container.querySelector('details > summary')?.textContent).toMatch(/^Confidence in /);
  });
});
