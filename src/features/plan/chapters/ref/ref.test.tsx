// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CHAPTER_PLANS } from '@/../test/fixtures/acme/plans/chapters-plans';
import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { planDataOf } from '@/../test/plan-kit';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';
import { bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { RefChapter } from '@/features/plan/chapters/ref/ref-chapter';

vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useSearchParams: () => new actual.ReadonlyURLSearchParams(globalThis.location.search),
    usePathname: () => globalThis.location.pathname,
  };
});

const bodiesOf = (plan: Plan, status: IssueStatus = {}) =>
  bodiesIn(planDataOf(plan, undefined, { status }), 'ref');

function screenOf(plan: Plan, key: string, status: IssueStatus = {}) {
  const bodies = bodiesOf(plan, status);
  const found = bodies.find((p) => p.page.screen === key);
  if (found === undefined) throw new Error(`no ${key}`);
  return found;
}

afterEach(cleanup);

describe('reference chapter', () => {
  it.each(CHAPTER_PLANS)('draws every catalogue of %s with a headline', (_, plan, status) => {
    for (const props of bodiesOf(plan, status)) {
      const { container, unmount } = render(<RefChapter {...props} />);
      expect(
        container.querySelector('h1 + div, h2 + div')?.textContent,
        props.page.screen,
      ).not.toBe('');
      unmount();
    }
  });

  it('lists a catalogue for every reference screen', () => {
    const bodies = bodiesOf(sameDay());
    const screens = bodies.map((p) => p.page.screen);
    expect(screens).toEqual(expect.arrayContaining(['services', 'stores', 'apis', 'decisions']));
  });

  it('filters services by what is typed', async () => {
    const { container } = render(<RefChapter {...screenOf(sameDay(), 'services')} />);
    const rows = [...container.querySelectorAll<HTMLElement>('[data-search]')];
    expect(rows.length).toBeGreaterThan(1);
    const word = rows[0]?.dataset.search?.split(' ')[0] ?? '';
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: `${word} zzzz-nothing` } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(rows.every((r) => r.hidden === true)).toBe(true);
    expect(container.textContent).toContain('Nothing matches that filter.');
  });
});
