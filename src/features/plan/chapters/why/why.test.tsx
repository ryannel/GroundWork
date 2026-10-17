// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ORDER_NOTES_DONE, orderNotes } from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { CHAPTER_PLANS } from '@/../test/fixtures/acme/plans/chapters-plans';
import { planDataOf } from '@/../test/plan-kit';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';
import { bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { WhyChapter } from '@/features/plan/chapters/why/why-chapter';

const bodiesOf = (plan: Plan, status: IssueStatus = {}) =>
  bodiesIn(planDataOf(plan, undefined, { status }), 'why');

function screenOf(plan: Plan, screen: string, status: IssueStatus = {}) {
  const bodies = bodiesOf(plan, status);
  const found = bodies.find((p) => p.page.screen === screen);
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

afterEach(cleanup);

describe('why chapter', () => {
  it.each(CHAPTER_PLANS)('draws every screen of %s with a headline', (_, plan, status) => {
    for (const props of bodiesOf(plan, status)) {
      const { container, unmount } = render(<WhyChapter {...props} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
      unmount();
    }
  });

  it('puts the evidence under the problem headline', () => {
    const { container } = render(
      <WhyChapter {...screenOf(orderNotes(), 'problem', ORDER_NOTES_DONE)} />,
    );
    expect(container.textContent).toContain('The evidence');
    expect(container.textContent).toContain('5% of orders');
  });

  it('opens the promise with the first goal and the time budget', () => {
    const { container } = render(
      <WhyChapter {...screenOf(orderNotes(), 'promise', ORDER_NOTES_DONE)} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^In 4 weeks, a note the customer writes reaches the courier/u,
    );
    expect(container.textContent).toContain('We also promise');
    expect(container.textContent).toContain('We won’t');
    expect(container.textContent).toContain('Time budget');
  });

  it('tells where the scenarios run', () => {
    const { container } = render(
      <WhyChapter {...screenOf(orderNotes(), 'scenarios', ORDER_NOTES_DONE)} />,
    );
    expect(container.querySelectorAll('article').length).toBeGreaterThan(0);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(/flow/u);
  });
});
