// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ORDER_NOTES_DONE,
  orderNotes,
  orderNotesUnfiled,
} from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { CHAPTER_PLANS } from '@/../test/fixtures/acme/plans/chapters-plans';
import { sameDay, sameDayConfident } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { planDataOf } from '@/../test/plan-kit';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';
import { bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { CommitChapter } from '@/features/plan/chapters/commit/commit-chapter';

const screens = (plan: Plan, status: IssueStatus = {}) =>
  bodiesIn(planDataOf(plan, undefined, { status }), 'commit');

function screenOf(plan: Plan, screen: string, status: IssueStatus = {}) {
  const list = screens(plan, status);
  const found = list.find((p) => p.page.screen === screen);
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

afterEach(cleanup);

describe('commit chapter', () => {
  it.each(CHAPTER_PLANS)('draws every screen of %s under a headline', (_, plan, status) => {
    const list = screens(plan, status);
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const body of list) {
      const { container, unmount } = render(<CommitChapter {...body} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
      unmount();
    }
  });

  it('groups the proposed choices apart from the accepted ones', () => {
    const { container } = render(<CommitChapter {...screenOf(sameDay(), 'choices')} />);
    const heads = [...container.querySelectorAll('h3')].map((h) => h.textContent);
    expect(heads).toContain('Proposed');
    expect(heads).toContain('Accepted');
    expect(container.querySelectorAll('article').length).toBeGreaterThan(3);
  });

  it('places the risks in a grid and gives each a card', () => {
    const { container } = render(<CommitChapter {...screenOf(sameDay(), 'risks')} />);
    expect(container.querySelector('figure')).not.toBeNull();
    expect(container.querySelectorAll('article')).toHaveLength(5);
    expect(container.textContent).toContain('Mitigation');
  });

  it('folds the rest of the register by kind', () => {
    const { container } = render(<CommitChapter {...screenOf(sameDay(), 'register')} />);
    expect(container.querySelectorAll('details').length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain('Kept here for the record.');
  });

  it('owes the answers by team, with the rule, before approval', () => {
    const { container } = render(<CommitChapter {...screenOf(sameDayConfident(), 'ask')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /owe two answers and two decisions/u,
    );
    expect(container.textContent).toContain('if nobody decides');
    expect(container.textContent).toContain('waiting on this');
    expect(container.textContent).toContain('What do the ratings do?');
    expect(container.textContent).toContain('Below 3, the plan is rethought.');
    expect(container.textContent).toContain('The plan’s owner approves');
  });

  it('puts the low rating first when a team is not confident', () => {
    const { container } = render(<CommitChapter {...screenOf(sameDay(), 'ask')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toMatch(
      /^Payments is not confident/u,
    );
    expect(container.textContent).toContain('Confidence ratings');
    expect(container.textContent).toContain('Also open:');
    expect(container.textContent).not.toContain('Below 3, the plan is rethought.');
  });

  it('says only what is open once the plan is approved', () => {
    const { container } = render(<CommitChapter {...screenOf(orderNotesUnfiled(), 'ask')} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toBe(
      'Approved 25 Mar. Teams build from 1.0.',
    );
    expect(container.textContent).not.toContain('What do the ratings do?');
  });

  it('folds the ratings of a delivered plan', () => {
    const { container } = render(
      <CommitChapter {...screenOf(orderNotes(), 'ask', ORDER_NOTES_DONE)} />,
    );
    expect(container.querySelector('h1 + div, h2 + div')?.textContent).toBe('Delivered 27 May.');
    expect(container.querySelector('details > summary')?.textContent).toMatch(/^Confidence in /u);
  });
});
