// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { ORDER_NOTES_DONE, orderNotes } from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { CHAPTER_PLANS } from '@/../test/fixtures/acme/plans/chapters-plans';
import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { planDataOf } from '@/../test/plan-kit';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';
import { bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { ProveChapter } from '@/features/plan/chapters/prove/prove-chapter';

const bodiesOf = (plan: Plan, status: IssueStatus = {}) =>
  bodiesIn(planDataOf(plan, undefined, { status }), 'prove');

function screenOf(plan: Plan, screen: string, status: IssueStatus = {}) {
  const bodies = bodiesOf(plan, status);
  const found = bodies.find((p) => p.page.screen === screen);
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

afterEach(cleanup);

describe('prove chapter', () => {
  it.each(CHAPTER_PLANS)('draws every screen of %s with a headline', (_, plan, status) => {
    for (const props of bodiesOf(plan, status)) {
      const { container, unmount } = render(<ProveChapter {...props} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
      unmount();
    }
  });

  it('says which flows no end-to-end test covers, and folds the brackets', () => {
    const { container } = render(
      <ProveChapter {...screenOf(orderNotes(), 'e2e', ORDER_NOTES_DONE)} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toBe(
      'No end-to-end test covers “Cancel an order”.',
    );
    expect(container.textContent).toContain('Not covered end to end');
    expect(container.querySelectorAll('details').length).toBeGreaterThan(0);
    expect(container.querySelector('details[open]')).not.toBeNull();
  });

  it('names the unit-only change above the matrix, with the flows behind the e2e counts', () => {
    const { container } = render(<ProveChapter {...screenOf(sameDay(), 'coverage')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toBe(
      'Every change has a test, but one has unit tests only.',
    );
    expect(container.textContent).toContain('Unit tests only:');
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });

  it('says the contract gap on the contracts screen', () => {
    const { container } = render(<ProveChapter {...screenOf(shop(), 'contracts')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toBe(
      'The re-routed call “ProductPage” has no contract test.',
    );
  });

  it('puts the chapter claim on the first screen only', () => {
    const bodies = bodiesOf(orderNotes(), ORDER_NOTES_DONE);
    const first = render(<ProveChapter {...bodies[0]!} />);
    expect(first.container.textContent).toContain(
      'Two contract tests and two end-to-end walks prove the note.',
    );
    first.unmount();
    const later = render(<ProveChapter {...bodies[1]!} />);
    expect(later.container.textContent).not.toContain(
      'Two contract tests and two end-to-end walks prove the note.',
    );
  });
});
