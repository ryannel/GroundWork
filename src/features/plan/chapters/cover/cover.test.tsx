// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ORDER_NOTES_DONE, orderNotes } from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { CHAPTER_PLANS } from '@/../test/fixtures/acme/plans/chapters-plans';
import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { planDataOf } from '@/../test/plan-kit';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';
import { bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { CoverChapter } from '@/features/plan/chapters/cover/cover-chapter';

vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useSearchParams: () => new actual.ReadonlyURLSearchParams(globalThis.location.search),
    useRouter: () =>
      ({ push: vi.fn<(href: string) => void>() }) as unknown as ReturnType<typeof actual.useRouter>,
  };
});

const bodiesOf = (plan: Plan, status: IssueStatus = {}) =>
  bodiesIn(planDataOf(plan, undefined, { status }), 'cover');

function screenOf(plan: Plan, screen: string, status: IssueStatus = {}) {
  const bodies = bodiesOf(plan, status);
  const found = bodies.find((p) => p.page.screen === screen);
  if (found === undefined) throw new Error(`no ${screen}`);
  return found;
}

beforeEach(() => {
  globalThis.history.replaceState(null, '', '/');
});
afterEach(cleanup);

describe('cover', () => {
  it.each(CHAPTER_PLANS)(
    'draws the cover and Your part of %s with a headline',
    (_, plan, status) => {
      for (const props of bodiesOf(plan, status)) {
        const { container, unmount } = render(<CoverChapter {...props} />);
        expect(container.querySelector('h1, h2')?.textContent, props.page.screen).not.toBe('');
        unmount();
      }
    },
  );

  it('opens with the plan’s title and a door to each team’s part', () => {
    const props = screenOf(orderNotes(), 'cover', ORDER_NOTES_DONE);
    const { container } = render(<CoverChapter {...props} />);
    expect(container.textContent).toContain(props.model.plan.meta.title);
    expect(container.querySelector('a[href*="/cover/part?team="]')).not.toBeNull();
  });
});

describe('Your part', () => {
  it('lists the teams, one line each, for everyone', () => {
    const props = screenOf(sameDay(), 'part');
    const { container } = render(<CoverChapter {...props} />);
    for (const team of props.model.plan.teams) {
      expect(container.textContent).toContain(props.model.label(team.id));
    }
  });

  it.each(CHAPTER_PLANS)('draws the page of the lens team of %s', (_, plan, status) => {
    const props = screenOf(plan, 'part', status);
    for (const team of props.model.plan.teams) {
      globalThis.history.replaceState(null, '', `/?team=${team.id}`);
      const { container, unmount } = render(<CoverChapter {...props} />);
      expect(container.querySelector<HTMLElement>('[data-lens]')?.dataset.lens).toBe(team.id);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
      unmount();
    }
  });
});
