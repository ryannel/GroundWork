// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ORDER_NOTES_DONE, orderNotes } from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { CHAPTER_PLANS } from '@/../test/fixtures/acme/plans/chapters-plans';
import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { careInput, STACKED_BASE } from '@/../test/fixtures/plan-index';
import { planDataOf } from '@/../test/plan-kit';
import { stackCoverVM } from '@/application/workspace-work/stack-cover';
import { workspacePlanIndexOf } from '@/application/workspace-work/workspace-plan-index';
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

function screenOf(plan: Plan, key: string, status: IssueStatus = {}) {
  const bodies = bodiesOf(plan, status);
  const found = bodies.find((p) => p.page.screen === key);
  if (found === undefined) throw new Error(`no ${key}`);
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

/** A link's address, with the slash Next drops before a query or at the end left off. */
const hrefOf = (name: string) =>
  screen
    .getByRole('link', { name })
    .getAttribute('href')
    ?.replace(/\/(?=\?|$)/u, '');

describe('the plans around it', () => {
  const index = workspacePlanIndexOf(careInput());

  it('says what a stacked plan reads after, what is not delivered there, its overlaps and how to re-check', () => {
    const stack = stackCoverVM(index, 'order-change', STACKED_BASE);
    render(<CoverChapter {...screenOf(sameDay(), 'cover')} stack={stack} />);
    const section = screen.getByRole('region', { name: 'The plans around it' });
    expect(section.textContent).toContain('Reads the systems after: Financing status ✓');
    expect(section.textContent).toContain('Checked against them on 25 Oct.');
    expect(hrefOf('Financing status')).toBe('/acme/plans/financing');
    expect(section.textContent).toContain('Send status events');
    expect(section.textContent).toContain('Financing status · Orders · in progress');
    expect(section.textContent).toContain('Both change svc:status: Ziklo quotes a change here');
    expect(hrefOf('Ziklo quotes a change')).toBe('/acme/plans/order-change/things?id=chg-quote');
    expect(hrefOf('Listing reads the status')).toBe(
      '/acme/plans/listing/things?id=chg-status-copy',
    );
    expect(section.querySelector('pre')?.textContent).toBe(
      'npm run plan:base -- check order-change --workspace acme',
    );
    expect(hrefOf('Care in Sweden')).toBe('/acme/programmes/care');
    expect(section.textContent).toContain('Part of Care in Sweden');
  });

  it('says a base changed since the plan was checked, and leaves the section out for a plan on its own', () => {
    const base = {
      ...STACKED_BASE,
      checkedOn: null,
      builtOn: [{ slug: 'financing', title: 'Financing status', changed: true }],
    };
    const { unmount } = render(
      <CoverChapter
        {...screenOf(sameDay(), 'cover')}
        stack={stackCoverVM(index, 'order-change', base)}
      />,
    );
    const section = screen.getByRole('region', { name: 'The plans around it' });
    expect(section.textContent).toContain('Financing status — changed since this plan was checked');
    expect(section.textContent).toContain('Never checked against them.');
    unmount();
    render(<CoverChapter {...screenOf(sameDay(), 'cover')} stack={null} />);
    expect(screen.queryByRole('region', { name: 'The plans around it' })).toBeNull();
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
      const { container, unmount } = render(<CoverChapter {...props} lens={team.id} />);
      expect(container.querySelector<HTMLElement>('[data-lens]')?.dataset.lens).toBe(team.id);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent).not.toBe('');
      unmount();
    }
  });
});
