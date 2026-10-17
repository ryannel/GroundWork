// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { orderNotes } from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { CHAPTER_PLANS } from '@/../test/fixtures/acme/plans/chapters-plans';
import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { planDataOf } from '@/../test/plan-kit';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';
import { ChangesChapter } from '@/features/plan/chapters/changes/changes-chapter';
import { bodiesIn } from '@/features/plan/chapters/chapter-kit';
import { walkBeside, walkMove } from '@/features/plan/walk-keys';

vi.mock(import('next/navigation'), async (original) => ({
  ...(await original()),
  usePathname: () => '/w/plans/p/changes/ledger/',
}));

const bodiesOf = (plan: Plan, status: IssueStatus = {}) =>
  bodiesIn(planDataOf(plan, undefined, { status }), 'changes');

afterEach(cleanup);

describe('changes chapter', () => {
  it.each(CHAPTER_PLANS)('draws every screen of %s with a headline', (_, plan, status) => {
    for (const props of bodiesOf(plan, status)) {
      const { container, unmount } = render(<ChangesChapter {...props} />);
      expect(
        container.querySelector('h1 + div, h2 + div')?.textContent ?? '',
        props.page.screen,
      ).not.toBe('');
      unmount();
    }
  });

  it('groups the records of a bigger plan and tabs the flows', () => {
    const bodies = bodiesOf(sameDay());
    const keys = bodies.map((b) => b.page.screen);
    expect(keys).toContain('ledger');
    const ledger = bodies.find((b) => b.page.screen === 'ledger');
    if (ledger === undefined) throw new Error('no ledger');
    const { container } = render(<ChangesChapter {...ledger} />);
    expect(container.textContent).toContain('By component');
  });

  it('steps between the ledger’s groupings and keeps the one shown in the address', () => {
    globalThis.history.replaceState(null, '', '/w/plans/p/changes/ledger/');
    const ledger = bodiesOf(sameDay()).find((b) => b.page.screen === 'ledger');
    if (ledger === undefined) throw new Error('no ledger');
    render(<ChangesChapter {...ledger} />);
    expect(walkBeside(1)).toBe('By team');
    act(() => {
      walkMove(1);
    });
    expect(new URLSearchParams(globalThis.location.search).get('stop')).toBe('team');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'By team' }).checked).toBe(true);
    expect(walkBeside(1)).toBeNull();
  });

  it('has a graph screen only where the plan changes a graph', () => {
    const graph = bodiesOf(shop()).find((b) => b.page.screen === 'graph');
    if (graph === undefined) throw new Error('no graph screen');
    const { container } = render(<ChangesChapter {...graph} />);
    expect(container.querySelector('h1 + div, h2 + div')?.textContent ?? '').toMatch(/\.$/u);
    expect(container.textContent).toContain('Operation');
    expect(container.textContent).toContain('Waterfalls: how each operation is answered');
    expect(container.querySelector('table')).not.toBeNull();
    for (const [name, plan] of [
      ['same-day', sameDay()],
      ['order-notes', orderNotes()],
    ] as const) {
      const keys = bodiesOf(plan).map((b) => b.page.screen);
      expect(keys, name).not.toContain('graph');
    }
  });

  it('answers nothing for a screen the layout does not have', () => {
    const [first] = bodiesOf(orderNotes());
    if (first === undefined) throw new Error('no screens');
    const { container } = render(
      <ChangesChapter {...first} page={{ ...first.page, screen: 'missing' }} />,
    );
    expect(container.textContent).toBe('');
  });
});
