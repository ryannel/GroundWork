// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ORDER_NOTES_DONE, orderNotes } from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { CHAPTER_PLANS } from '@/../test/fixtures/acme/plans/chapters-plans';
import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { EVENTS, ORDER_CHANGE, TEAMS } from '@/../test/fixtures/plan-index';
import { planDataOf } from '@/../test/plan-kit';
import { derive } from '@/application/plan/derive';
import { standingOf } from '@/application/plan/work-standing';
import { outlineOf } from '@/application/plan-pages';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';
import { BuildChapter } from '@/features/plan/chapters/build/build-chapter';
import { bodiesIn } from '@/features/plan/chapters/chapter-kit';

function screenOf(plan: Plan, key: string, status: IssueStatus = {}) {
  const found = bodiesIn(planDataOf(plan, undefined, { status }), 'build').find(
    (p) => p.page.screen === key,
  );
  if (found === undefined) throw new Error(`no ${key}`);
  return found;
}

afterEach(cleanup);

describe('build chapter', () => {
  it.each(CHAPTER_PLANS)('draws both screens of %s under a headline', (_, plan, status) => {
    for (const key of ['build-order', 'work-by-team']) {
      const { container, unmount } = render(<BuildChapter {...screenOf(plan, key, status)} />);
      expect(container.querySelector('h1 + div, h2 + div')?.textContent, key).not.toBe('');
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

describe('build with a partner', () => {
  const model = derive(ORDER_CHANGE, {
    status: {},
    today: new Date('2026-11-04'),
    standing: {
      ...standingOf(
        ORDER_CHANGE,
        { events: [...(EVENTS['order-change'] ?? [])] },
        { teams: TEAMS },
      ),
      changes: [],
    },
  });
  const data = { model, outline: outlineOf(model, { workspace: 'acme', slug: 'order-change' }) };
  const bodyOf = (screenKey: string) => {
    const found = bodiesIn(data, 'build').find((p) => p.page.screen === screenKey);
    if (found === undefined) throw new Error(`no ${screenKey}`);
    return found;
  };

  it('puts the partner’s item in its real wave, before ours that waits on it, on the same card', () => {
    const { container } = render(<BuildChapter {...bodyOf('build-order')} />);
    const waves = [...container.querySelectorAll('section, details')].filter(
      (wave) => wave.querySelector('article') !== null,
    );
    const titles = waves.map((wave) =>
      [...wave.querySelectorAll('article')].map((card) => card.getAttribute('aria-label')),
    );
    expect(titles.slice(0, 2)).toEqual([['Provide the order-change quote'], ['Track revisions']]);
    const partner = screen.getByRole('article', { name: 'Provide the order-change quote' });
    expect(partner.textContent).toContain('Ziklo · we depend on this');
    expect(partner.textContent).toContain('14 days after we need');
    expect(within(partner).getByRole('button', { name: 'Record update' })).toBeDefined();
    const ours = screen.getByRole('article', { name: 'Track revisions' });
    expect(ours.textContent).toContain('Orders owns');
    expect(within(ours).getByRole('link', { name: /^GitHub issue #41/u })).toBeDefined();
  });

  it('files only our items as GitHub issues, and says how many partner items are recorded apart', () => {
    const { container } = render(<BuildChapter {...bodyOf('work-by-team')} />);
    const send = [...container.querySelectorAll('details')].find((d) =>
      d.textContent.includes('Send to GitHub'),
    );
    expect(send?.textContent).toContain(
      '1 partner item recorded separately, in progress.yaml rather than as GitHub issues.',
    );
    const filed = [...(send?.querySelectorAll(':scope details summary') ?? [])].map(
      (x) => x.textContent,
    );
    expect(filed).toHaveLength(1);
    expect(filed[0]).toContain('Track revisions');
  });
});
