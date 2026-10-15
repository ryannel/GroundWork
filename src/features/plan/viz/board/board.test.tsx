// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { GateChip } from '@/features/plan/viz/board/gate-chip';
import { MilestoneBoard } from '@/features/plan/viz/board/milestone-board';
import { MilestoneCard } from '@/features/plan/viz/board/milestone-card';
import { WorkChip } from '@/features/plan/viz/board/work-chip';
import { WorkExport } from '@/features/plan/viz/board/work-export';
import { WorkItemCard } from '@/features/plan/viz/board/work-item-card';
import { WorkItemRows } from '@/features/plan/viz/board/work-item-rows';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function load(delivery: boolean) {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'delivery-promise');
  const plan = loaded.plan!;
  if (!delivery) return derive(plan);
  const work = plan.work_items!.map((w) => {
    if (w.id === 'wi:carrier-lead-time-api') return { ...w, github_issue: 41 };
    if (w.id === 'wi:promise-service') return { ...w, github_issue: 42 };
    return w;
  });
  return derive(
    { ...plan, work_items: work },
    {
      status: {
        'wi:carrier-lead-time-api': { state: 'closed', closed_at: '2026-11-02T10:00:00Z' },
        'wi:promise-service': {
          state: 'open',
          url: 'https://github.com/alder-finch/fulfilment/issues/42',
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
  it('shows a proposed decision with its decider and date, and says when an open question is late', async () => {
    const { plan } = await load(false);
    const model = derive({
      ...plan,
      decisions: [
        {
          id: 'dec:wait',
          title: 'Pick a carrier',
          status: 'proposed',
          decider: 'team:fulfilment',
          decide_by: '2020-01-10',
        },
      ],
      questions: [
        {
          id: 'q:late',
          question: 'Which one?',
          status: 'open',
          decider: 'team:fulfilment',
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
    expect(dec.textContent).toContain('Pick a carrier');
    expect(dec.textContent).toContain('10 Jan 2020');
    expect(flagged(dec, 'late')).toBe(false);
    const q = inspect(container, 'q:late')!;
    expect(flagged(q, 'late')).toBe(true);
    expect(q.textContent).toContain('overdue');
  });

  it('draws nothing for an id that is not a gate', async () => {
    const { container } = render(<GateChip id="wi:promise-service" model={await load(false)} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('WorkChip', () => {
  it('shows the title, and a tick once the item is done', async () => {
    const model = await load(true);
    const { container } = render(
      <>
        <WorkChip id="wi:carrier-lead-time-api" model={model} />
        <WorkChip id="wi:promise-service" model={model} />
        <WorkChip id="wi:nothing" model={model} />
      </>,
    );
    expect(inspect(container, 'wi:carrier-lead-time-api')!.textContent).toContain('✓');
    expect(flagged(inspect(container, 'wi:carrier-lead-time-api'), 'done')).toBe(true);
    expect(inspect(container, 'wi:promise-service')!.textContent).not.toContain('✓');
    expect(container.querySelectorAll('button')).toHaveLength(2);
  });

  it('clips a long title unless asked for all of it', async () => {
    const model = await load(false);
    const title = model.plan.work_items!.find((w) => w.id === 'wi:pim-promise')!.title;
    const clipped = render(<WorkChip id="wi:pim-promise" model={model} />);
    expect(clipped.container.textContent.length).toBeLessThan(title.length);
    cleanup();
    const full = render(<WorkChip full id="wi:pim-promise" model={model} />);
    expect(full.container.textContent).toBe(title);
  });
});

describe('WorkItemCard', () => {
  it('shows the state, issue link, size, milestone, team and what it needs', async () => {
    const model = await load(true);
    const w = model.plan.work_items!.find((x) => x.id === 'wi:promise-service')!;
    const { container } = render(<WorkItemCard model={model} w={w} />);
    const card = container.querySelector('article')!;
    expect(card.textContent).toContain('open');
    expect(card.querySelector('a')!.getAttribute('href')).toBe(
      'https://github.com/alder-finch/fulfilment/issues/42',
    );
    expect(card.textContent).toContain('XL');
    expect(inspect(container, 'ms:promise-exists')).not.toBeNull();
    expect(card.textContent).toContain('needs');
    expect(inspect(container, 'wi:carrier-lead-time-api')).not.toBeNull();
    expect(card.textContent).toContain('blocks');
    expect(card.dataset.facts!.startsWith('open|#42|XL|')).toBe(true);
    expect(card.dataset.density).toBe('card');
  });

  it('shows no state before delivery, dims other teams, and tags a revision', async () => {
    const model = await load(false);
    const w = model.plan.work_items!.find((x) => x.id === 'wi:pim-promise')!;
    const { container } = render(
      <WorkItemCard
        lens="team:fulfilment"
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

  it('leaves out the waits-on chips when told to', async () => {
    const { plan } = await load(false);
    const w = plan.work_items!.find((x) => x.id === 'wi:pim-promise')!;
    const model = derive({
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
  it('draws one row per item, with heads when asked', async () => {
    const model = await load(false);
    const items = model.plan.work_items!.slice(0, 3);
    const { container } = render(<WorkItemRows head items={items} model={model} />);
    expect(container.querySelectorAll('article')).toHaveLength(3);
    expect(container.querySelectorAll<HTMLElement>('article')[0]!.dataset.density).toBe('row');
    expect(container.textContent).toContain('Work item');
    expect(container.querySelector('[data-no-state]')).not.toBeNull();
  });

  it('draws nothing for no items', async () => {
    const { container } = render(<WorkItemRows items={[]} model={await load(false)} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('MilestoneCard', () => {
  it('shows its name, due date, state and what works', async () => {
    const model = await load(false);
    const { container } = render(
      <MilestoneCard model={model} msId="ms:promise-exists" today={new Date('2026-11-20')} />,
    );
    const card = container.querySelector('aside')!;
    expect(card.getAttribute('aria-label')).toBe('M1');
    expect(card.textContent).toContain('The promise exists');
    expect(card.querySelector('time')!.getAttribute('datetime')).toBe('2026-11-13');
    expect(card.textContent).toContain('When M1 is done');
    expect(card.textContent).toContain('due date passed');
    expect(card.textContent).toContain('What works');
    expect(card.dataset.facts).toBe('ms:promise-exists|When M1 is done|due 13 Nov|due date passed');
  });

  it('shows progress in delivery as one segment per item', async () => {
    const model = await load(true);
    const { container } = render(<MilestoneCard model={model} msId="ms:promise-exists" />);
    const segments = container.querySelectorAll('[aria-hidden="true"] > span');
    const total = model.plan.work_items!.filter((w) => w.milestone === 'ms:promise-exists').length;
    expect(segments).toHaveLength(total);
    expect(container.querySelectorAll('[data-done]').length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain(`1 of ${String(total)} done`);
  });

  it('has a strip form with just the name and state', async () => {
    const model = await load(true);
    const { container } = render(
      <MilestoneCard density="chip" model={model} msId="ms:promise-exists" />,
    );
    expect(container.querySelector('aside')).toBeNull();
    expect(inspect(container, 'ms:promise-exists')).not.toBeNull();
    expect(container.textContent).toContain('1 of ');
  });

  it('draws nothing for an unknown milestone', async () => {
    const { container } = render(<MilestoneCard model={await load(false)} msId="ms:nothing" />);
    expect(container.innerHTML).toBe('');
  });
});

describe('MilestoneBoard', () => {
  it('shows the card, then the milestone’s work', async () => {
    const model = await load(false);
    const { container } = render(<MilestoneBoard model={model} msId="ms:promise-exists" />);
    expect(container.querySelector('aside')).not.toBeNull();
    const total = model.plan.work_items!.filter((w) => w.milestone === 'ms:promise-exists').length;
    expect(container.querySelectorAll('article')).toHaveLength(total);
  });

  it('says so when a milestone has no work', async () => {
    const { plan } = await load(false);
    const model = derive({
      ...plan,
      milestones: [...plan.milestones!, { id: 'ms:empty', name: 'M9 · Empty' }],
    });
    render(<MilestoneBoard model={model} msId="ms:empty" />);
    expect(screen.getByText('No work items in this milestone.')).toBeTruthy();
  });
});

describe('WorkExport', () => {
  it('groups work by team, the lens first, each item a collapsed issue preview', async () => {
    const model = await load(false);
    const { container } = render(<WorkExport lens="team:fulfilment" model={model} />);
    const sections = [...container.querySelectorAll('section')];
    expect(sections[0]!.querySelector<HTMLElement>('[data-inspect]')!.dataset.inspect).toBe(
      'team:fulfilment',
    );
    expect(flagged(sections[1]!, 'dim')).toBe(true);
    expect(container.querySelectorAll('details')).toHaveLength(model.plan.work_items!.length);
    expect(container.querySelector('details')!.hasAttribute('open')).toBe(false);
    expect(container.querySelector('pre')!.textContent.length).toBeGreaterThan(0);
  });

  it('copies an item, and a whole team, as text', async () => {
    const writeText = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const model = await load(false);
    render(<WorkExport model={model} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy as text' })[0]!);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const text = (writeText.mock.calls as unknown as string[][])[0]![0]!;
    expect(text.startsWith('# ')).toBe(true);
    const all = screen.getAllByRole('button', { name: /^Copy every .* work item as one text$/ });
    expect(all[0]!.textContent).toMatch(/^Copy as text \(all \d+\)$/);
  });

  it('says so when there is no work', async () => {
    const { plan } = await load(false);
    render(<WorkExport model={derive({ ...plan, work_items: [] })} />);
    expect(screen.getByText('No work items in this plan.')).toBeTruthy();
  });
});
