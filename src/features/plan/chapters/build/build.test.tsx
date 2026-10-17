// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ORDER_NOTES_DONE, orderNotes } from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { CHAPTER_PLANS } from '@/../test/fixtures/acme/plans/chapters-plans';
import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { planDataOf } from '@/../test/plan-kit';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';
import { BuildChapter } from '@/features/plan/chapters/build/build-chapter';
import { bodiesIn } from '@/features/plan/chapters/chapter-kit';

function screenOf(plan: Plan, screen: string, status: IssueStatus = {}) {
  const found = bodiesIn(planDataOf(plan, undefined, { status }), 'build').find(
    (p) => p.page.screen === screen,
  );
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

afterEach(cleanup);

describe('build chapter', () => {
  it.each(CHAPTER_PLANS)('draws both screens of %s under a headline', (_, plan, status) => {
    for (const screen of ['build-order', 'work-by-team']) {
      const { container, unmount } = render(<BuildChapter {...screenOf(plan, screen, status)} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
      unmount();
    }
  });

  it('leads the order with the gate, then the waves and the graph', () => {
    const { container } = render(<BuildChapter {...screenOf(sameDay(), 'build-order')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^M1 waits on Catalogue’s/u,
    );
    expect(container.textContent).toContain('First, once approved');
    expect(container.querySelector('details svg')).not.toBeNull();
    expect(container.textContent).toContain('Dependency graph, with the critical path');
  });

  it('folds the finished waves of a delivered plan', () => {
    const { container } = render(
      <BuildChapter {...screenOf(orderNotes(), 'build-order', ORDER_NOTES_DONE)} />,
    );
    expect(container.textContent).toContain('How it was built');
    expect(container.textContent).toContain('Wave 1 · done');
  });

  it('gives each team its work and the work as issues', () => {
    const { container } = render(<BuildChapter {...screenOf(sameDay(), 'work-by-team')} />);
    expect(container.querySelectorAll('section').length).toBeGreaterThanOrEqual(3);
    expect(container.textContent).toContain('Send to GitHub');
    expect(container.textContent).toContain('next item waits on');
  });
});
