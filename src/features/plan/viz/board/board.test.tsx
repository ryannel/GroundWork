// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { GateChip } from '@/features/plan/viz/board/gate-chip';
import { MilestoneBoard } from '@/features/plan/viz/board/milestone-board';
import { MilestoneCard } from '@/features/plan/viz/board/milestone-card';
import { WorkChip } from '@/features/plan/viz/board/work-chip';
import { WorkExport } from '@/features/plan/viz/board/work-export';
import { WorkItemCard } from '@/features/plan/viz/board/work-item-card';
import { WorkItemRows } from '@/features/plan/viz/board/work-item-rows';

afterEach(cleanup);

function load(delivery: boolean) {
  const plan = dispatchDate();
  if (!delivery) return modelOf(plan);
  const work = plan.work_items!.map((w) => {
    if (w.id === 'wi:dispatch-field') return { ...w, github_issue: 41 };
    if (w.id === 'wi:publish-v2') return { ...w, github_issue: 42 };
    return w;
  });
  return modelOf(
    { ...plan, work_items: work },
    {
      status: {
        'wi:dispatch-field': { state: 'closed', closed_at: '2026-11-02T10:00:00Z' },
        'wi:publish-v2': {
          state: 'open',
          url: 'https://github.com/acme/products/issues/42',
        },
      },
    },
  );
}

const inspect = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-inspect="${id}"]`);
const flagged = (el: Element | null, name: string): boolean =>
  el?.hasAttribute(`data-${name}`) === true;

describe('GateChip', () => {
  it('shows a proposed decision with its decider and date, and says when an open question is late', () => {
    const { plan } = load(false);
    const model = modelOf({
      ...plan,
      decisions: [
        {
          id: 'dec:wait',
          title: 'Pick a region',
          status: 'proposed',
          decider: 'team:catalogue',
          decide_by: '2020-01-10',
        },
      ],
      questions: [
        {
          id: 'q:late',
          question: 'Which one?',
          status: 'open',
          decider: 'team:catalogue',
          decide_by: '2020-01-01',
        },
      ],
    });
    const { container } = render(
      <>
        <GateChip id="dec:wait" model={model} />
        <GateChip id="q:late" model={model} />
      </>,
    );
    const dec = inspect(container, 'dec:wait')!;
    expect(dec.textContent).toContain('Pick a region');
    expect(dec.textContent).toContain('10 Jan 2020');
    expect(flagged(dec, 'late')).toBe(false);
    const q = inspect(container, 'q:late')!;
    expect(flagged(q, 'late')).toBe(true);
    expect(q.textContent).toContain('overdue');
  });

  it('draws nothing for an id that is not a gate', () => {
    const { container } = render(<GateChip id="wi:publish-v2" model={load(false)} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('WorkChip', () => {
  it('shows the title, and a tick once the item is done', () => {
    const model = load(true);
    const { container } = render(
      <>
        <WorkChip id="wi:dispatch-field" model={model} />
        <WorkChip id="wi:publish-v2" model={model} />
        <WorkChip id="wi:nothing" model={model} />
      </>,
    );
    expect(inspect(container, 'wi:dispatch-field')!.textContent).toContain('✓');
    expect(flagged(inspect(container, 'wi:dispatch-field'), 'done')).toBe(true);
    expect(inspect(container, 'wi:publish-v2')!.textContent).not.toContain('✓');
    expect(container.querySelectorAll('button')).toHaveLength(2);
  });

  it('clips a long title unless asked for all of it', () => {
    const model = load(false);
    const title = model.plan.work_items!.find((w) => w.id === 'wi:shop-date')!.title;
    const clipped = render(<WorkChip id="wi:shop-date" model={model} />);
    expect(clipped.container.textContent.length).toBeLessThan(title.length);
    cleanup();
    const full = render(<WorkChip full id="wi:shop-date" model={model} />);
    expect(full.container.textContent).toBe(title);
  });
});

describe('WorkItemCard', () => {
  it('shows the state, issue link, size, milestone, team and what it needs', () => {
    const model = load(true);
    const w = model.plan.work_items!.find((x) => x.id === 'wi:publish-v2')!;
    const { container } = render(<WorkItemCard model={model} w={w} />);
    const card = container.querySelector('article')!;
    expect(card.textContent).toContain('open');
    expect(card.querySelector('a')!.getAttribute('href')).toBe(
      'https://github.com/acme/products/issues/42',
    );
    expect(card.textContent).toContain('Publish product.changed v2');
    expect(inspect(container, 'ms:m1')).not.toBeNull();
    expect(card.textContent).toContain('needs');
    expect(inspect(container, 'wi:dispatch-field')).not.toBeNull();
    expect(card.textContent).toContain('blocks');
    expect(inspect(container, 'wi:indexer-v2')).not.toBeNull();
    expect(inspect(container, 'wi:orders-v2')).not.toBeNull();
    expect(card.dataset.facts!.startsWith('open|#42|M|')).toBe(true);
    expect(card.dataset.density).toBe('card');
  });

  it('shows no state before delivery, dims other teams, and tags a revision', () => {
    const model = load(false);
    const w = model.plan.work_items!.find((x) => x.id === 'wi:shop-date')!;
    const { container } = render(
      <WorkItemCard
        lens="team:catalogue"
        model={model}
        revision={{ version: '1.2', effect: 'rework', authored: false, note: null }}
        w={w}
      />,
    );
    const card = container.querySelector('article')!;
    expect(flagged(card, 'dim')).toBe(true);
    expect(card.textContent).not.toContain('not started');
    expect(card.textContent).toContain('reopened in 1.2');
  });

  it('leaves out the waits-on chips when told to', () => {
    const { plan } = load(false);
    const w = plan.work_items!.find((x) => x.id === 'wi:shop-date')!;
    const model = modelOf({
      ...plan,
      questions: [{ id: 'q:held', question: 'Held up?', status: 'open', blocks: [w.id] }],
    });
    const shown = render(<WorkItemCard model={model} w={w} />);
    expect(shown.container.textContent).toContain('waits on');
    cleanup();
    const hidden = render(<WorkItemCard model={model} w={w} waits={false} />);
    expect(hidden.container.textContent).not.toContain('waits on');
  });
});

describe('WorkItemRows', () => {
  it('draws one row per item, with heads when asked', () => {
    const model = load(false);
    const items = model.plan.work_items!.slice(0, 3);
    const { container } = render(<WorkItemRows head items={items} model={model} />);
    expect(container.querySelectorAll('article')).toHaveLength(3);
    expect(container.querySelectorAll<HTMLElement>('article')[0]!.dataset.density).toBe('row');
    expect(container.textContent).toContain('Work item');
    expect(container.querySelector('[data-no-state]')).not.toBeNull();
  });

  it('draws nothing for no items', () => {
    const { container } = render(<WorkItemRows items={[]} model={load(false)} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('MilestoneCard', () => {
  it('shows its name, due date, state and what works', () => {
    const model = load(false);
    const { container } = render(
      <MilestoneCard model={model} msId="ms:m1" today={new Date('2026-11-20')} />,
    );
    const card = container.querySelector('aside')!;
    expect(card.getAttribute('aria-label')).toBe('M1');
    expect(card.textContent).toContain('Dates exist');
    expect(card.querySelector('time')!.getAttribute('datetime')).toBe('2026-11-13');
    expect(card.textContent).toContain('When M1 is done');
    expect(card.textContent).toContain('due date passed');
    expect(card.textContent).toContain('What works');
    expect(card.dataset.facts).toBe('ms:m1|When M1 is done|due 13 Nov|due date passed');
  });

  it('shows progress in delivery as one segment per item', () => {
    const model = load(true);
    const { container } = render(<MilestoneCard model={model} msId="ms:m1" />);
    const segments = container.querySelectorAll('[aria-hidden="true"] > span');
    const total = model.plan.work_items!.filter((w) => w.milestone === 'ms:m1').length;
    expect(total).toBe(2);
    expect(segments).toHaveLength(total);
    expect(container.querySelectorAll('[data-done]').length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain(`1 of ${String(total)} done`);
  });

  it('has a strip form with just the name and state', () => {
    const model = load(true);
    const { container } = render(<MilestoneCard density="chip" model={model} msId="ms:m1" />);
    expect(container.querySelector('aside')).toBeNull();
    expect(inspect(container, 'ms:m1')).not.toBeNull();
    expect(container.textContent).toContain('1 of ');
  });

  it('draws nothing for an unknown milestone', () => {
    const { container } = render(<MilestoneCard model={load(false)} msId="ms:nothing" />);
    expect(container.innerHTML).toBe('');
  });
});

describe('MilestoneBoard', () => {
  it('shows the card, then the milestone’s work', () => {
    const model = load(false);
    const { container } = render(<MilestoneBoard model={model} msId="ms:m1" />);
    expect(container.querySelector('aside')).not.toBeNull();
    const total = model.plan.work_items!.filter((w) => w.milestone === 'ms:m1').length;
    expect(container.querySelectorAll('article')).toHaveLength(total);
  });

  it('says so when a milestone has no work', () => {
    const { plan } = load(false);
    const model = modelOf({
      ...plan,
      milestones: [...plan.milestones!, { id: 'ms:empty', name: 'M9 · Empty' }],
    });
    render(<MilestoneBoard model={model} msId="ms:empty" />);
    expect(screen.getByText('No work items in this milestone.')).toBeTruthy();
  });
});

describe('WorkExport', () => {
  it('groups work by team, the lens first, each item a collapsed issue preview', () => {
    const model = load(false);
    const { container } = render(<WorkExport lens="team:catalogue" model={model} />);
    const sections = [...container.querySelectorAll('section')];
    expect(sections[0]!.querySelector<HTMLElement>('[data-inspect]')!.dataset.inspect).toBe(
      'team:catalogue',
    );
    expect(flagged(sections[1]!, 'dim')).toBe(true);
    expect(container.querySelectorAll('details')).toHaveLength(model.plan.work_items!.length);
    expect(container.querySelector('details')!.hasAttribute('open')).toBe(false);
    expect(container.querySelector('pre')!.textContent.length).toBeGreaterThan(0);
  });

  it('copies an item, and a whole team, as text', async () => {
    const writeText = vi.fn<(text: string) => Promise<boolean>>().mockResolvedValue(true);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const model = load(false);
    render(<WorkExport model={model} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy as text' })[0]!);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const text = (writeText.mock.calls as unknown as string[][])[0]![0]!;
    expect(text.startsWith('# ')).toBe(true);
    const all = screen.getAllByRole('button', { name: /^Copy every .* work item as one text$/u });
    expect(all.map((b) => b.textContent).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'Copy as text',
      'Copy as text',
      'Copy as text (all 4)',
    ]);
    expect(
      screen.getByRole('button', { name: 'Copy every Catalogue work item as one text' })
        .textContent,
    ).toBe('Copy as text (all 4)');
  });

  it('says so when there is no work', () => {
    const { plan } = load(false);
    render(<WorkExport model={modelOf({ ...plan, work_items: [] })} />);
    expect(screen.getByText('No work items in this plan.')).toBeTruthy();
  });
});
