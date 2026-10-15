// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { gateOf } from '@/application/plan-viz-gate';
import { buildSummary, chipSummary, msFacts, msState } from '@/application/plan-viz-milestone';
import {
  criticalSet,
  dependentsOf,
  issueNumber,
  issueUrl,
  milestoneById,
  orderTeams,
  revisionTag,
  teamSlot,
  wiState,
  workById,
  workFacts,
  workOrdered,
} from '@/application/plan-viz-work';

vi.mock('server-only', () => ({}));

const TODAY = new Date('2026-11-20T09:00:00Z');

async function load() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'delivery-promise');
  return loaded.plan!;
}

/** The plan once delivery has begun: one item closed, one open, the rest not yet filed. */
async function inDelivery() {
  const plan = await load();
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

describe('work items', () => {
  it('lists them dependencies first', async () => {
    const model = derive(await load());
    const order = workOrdered(model).map((w) => w.id);
    expect(order.indexOf('wi:carrier-lead-time-api')).toBeLessThan(
      order.indexOf('wi:promise-service'),
    );
    expect(order.indexOf('wi:promise-service')).toBeLessThan(order.indexOf('wi:pim-promise'));
    expect(
      workOrdered(model, (w) => w.team === 'team:catalog').every((w) => w.team === 'team:catalog'),
    ).toBe(true);
  });

  it('has no state before delivery begins', async () => {
    const model = derive(await load());
    expect(wiState(model, 'wi:promise-service')).toBeNull();
    const facts = workFacts(model, workById(model, 'wi:carrier-lead-time-api')!, () => 'M1');
    expect(facts.startsWith('||S|M1')).toBe(true);
  });

  it('reads done, open and not started from the issues', async () => {
    const model = await inDelivery();
    expect(wiState(model, 'wi:carrier-lead-time-api')).toBe('done');
    expect(wiState(model, 'wi:promise-service')).toBe('open');
    expect(wiState(model, 'wi:pim-promise')).toBe('not-started');
    expect(wiState(model, 'wi:nothing')).toBeNull();
    const facts = workFacts(model, workById(model, 'wi:carrier-lead-time-api')!, () => 'M1');
    expect(facts.startsWith('done|#41|S|M1')).toBe(true);
  });

  it('links an issue from the status file, else from the repo', async () => {
    const model = await inDelivery();
    const open = workById(model, 'wi:promise-service')!;
    expect(issueNumber(open)).toBe('#42');
    expect(issueUrl(model, open)).toBe('https://github.com/alder-finch/fulfilment/issues/42');
    const closed = workById(model, 'wi:carrier-lead-time-api')!;
    expect(issueUrl(model, closed)).toBe('https://github.com/alder-finch/fulfilment/issues/41');
    const unfiled = workById(model, 'wi:pim-promise')!;
    expect(issueNumber(unfiled)).toBe('');
    expect(issueUrl(model, unfiled)).toBeNull();
  });

  it('finds what depends on an item, and the critical path', async () => {
    const model = derive(await load());
    expect(dependentsOf(model, 'wi:carrier-lead-time-api').map((w) => w.id)).toContain(
      'wi:promise-service',
    );
    expect(criticalSet(model).size).toBeGreaterThan(0);
    expect(milestoneById(model, 'ms:promise-exists')?.name).toContain('M1');
    expect(milestoneById(model)).toBeUndefined();
  });

  it('orders teams by lane, each once', async () => {
    const model = derive(await load());
    const teams = orderTeams(model, ['team:fulfilment', 'team:catalog', 'team:fulfilment']);
    expect(teams).toHaveLength(2);
    expect(
      teams.map((t) => teamSlot(model, { ...workById(model, 'wi:pim-promise')!, team: t })),
    ).toEqual(
      teams
        .map((t) => teamSlot(model, { ...workById(model, 'wi:pim-promise')!, team: t }))
        .toSorted((a, b) => a - b),
    );
  });

  it('words what a proposal does to an item', () => {
    const tag = revisionTag({ version: '1.2', effect: 'rework', authored: false, note: null });
    expect(tag).toEqual({
      text: 'reopened in 1.2',
      why: 'Inferred from the changes it builds',
      pending: false,
    });
    const added = revisionTag({ version: '1.2', effect: 'new', authored: true, note: 'extra' });
    expect(added.pending).toBe(true);
    expect(added.text).toBe('new in 1.2 · not approved');
    expect(added.why).toContain('Only in the proposed 1.2');
    expect(revisionTag({ version: null, effect: 'keep', authored: true, note: null }).text).toBe(
      'no change',
    );
  });
});

describe('milestones', () => {
  it('says "When M1 is done" before delivery, with a due date', async () => {
    const model = derive(await load());
    const st = msState(model, 'ms:promise-exists', TODAY)!;
    expect(st.started).toBe(false);
    expect(st.text).toBe('When M1 is done');
    expect(st.dueText).toBe('due 13 Nov');
    expect(st.late).toBe(true);
    expect(st.title).toBe('The promise exists');
    expect(chipSummary(st)).toBe('due 13 Nov');
    expect(msFacts(st)).toBe('ms:promise-exists|When M1 is done|due 13 Nov|due date passed');
    expect(msState(model, 'ms:nothing')).toBeNull();
  });

  it('counts done items in delivery', async () => {
    const model = await inDelivery();
    const st = msState(model, 'ms:promise-exists', TODAY)!;
    expect(st.started).toBe(true);
    expect(st.done).toBe(1);
    expect(st.text).toBe(`1 of ${String(st.total)} done`);
    expect(chipSummary(st)).toBe(st.text);
    expect(st.allDone).toBe(false);
  });

  it('says when every item is done and when it finished', async () => {
    const plan = await load();
    const ids = plan
      .work_items!.filter((w) => w.milestone === 'ms:promise-exists')
      .map((w) => w.id);
    const work = plan.work_items!.map((w) => (ids.includes(w.id) ? { ...w, github_issue: 7 } : w));
    const status = Object.fromEntries(
      ids.map((id) => [id, { state: 'closed' as const, closed_at: '2026-11-09T08:00:00Z' }]),
    );
    const model = derive({ ...plan, work_items: work }, { status });
    const st = msState(model, 'ms:promise-exists', TODAY)!;
    expect(st.allDone).toBe(true);
    expect(st.late).toBe(false);
    expect(st.text).toBe('M1 done 9 Nov');
    expect(chipSummary(st)).toBe('done 9 Nov');
  });

  it('sums the build', async () => {
    const before = buildSummary(derive(await load()), TODAY);
    expect(before.started).toBe(false);
    expect(before.current).toBeNull();
    expect(before.delivered).toBe(false);
    expect(before.total).toBe(before.items.length);
    const model = await inDelivery();
    const after = buildSummary(model, TODAY);
    expect(after.started).toBe(true);
    expect(after.done).toBe(1);
    expect(after.todo).toHaveLength(after.total - 1);
    expect(after.current?.id).toBe('ms:promise-exists');
    expect(after.left.every((w) => w.milestone === 'ms:promise-exists')).toBe(true);
    expect(after.pathTeams.length).toBeGreaterThan(0);
  });
});

describe('gates', () => {
  it('draws a question or a proposed decision, and nothing else', async () => {
    const plan = await load();
    const question = plan.questions![0]!;
    const model = derive({
      ...plan,
      decisions: [
        {
          id: 'dec:wait',
          title: 'Pick a carrier',
          status: 'proposed',
          decider: 'team:fulfilment',
          decide_by: '2026-11-10',
        },
      ],
    });
    const q = gateOf(model, question.id, TODAY)!;
    expect(q.decision).toBe(false);
    expect(q.aria).toContain('question');
    const d = gateOf(model, 'dec:wait', TODAY)!;
    expect(d.decision).toBe(true);
    expect(d.decider).toBe('team:fulfilment');
    expect(d.dateText).toBe('10 Nov');
    expect(d.late).toBe(false);
    expect(d.aria).toContain('proposed decision: Pick a carrier, decided by Fulfilment, by 10 Nov');
    expect(gateOf(model, 'wi:promise-service', TODAY)).toBeNull();
  });

  it('flags an open question past its date', async () => {
    const plan = await load();
    const model = derive({
      ...plan,
      questions: [
        {
          id: 'q:late',
          question: 'Which one?',
          status: 'open',
          decider: 'team:fulfilment',
          decide_by: '2026-11-01',
        },
      ],
    });
    const gate = gateOf(model, 'q:late', TODAY)!;
    expect(gate.late).toBe(true);
    expect(gate.aria).toContain('overdue');
  });
});
