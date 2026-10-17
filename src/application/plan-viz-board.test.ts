// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
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

const TODAY = new Date('2026-11-20T09:00:00Z');

const load = dispatchDate;

/** The plan once delivery has begun: one item closed, one open, the rest not yet filed. */
function inDelivery() {
  const plan = load();
  const work = plan.work_items!.map((w) => {
    if (w.id === 'wi:dispatch-field') return { ...w, github_issue: 41 };
    if (w.id === 'wi:publish-v2') return { ...w, github_issue: 42 };
    return w;
  });
  return derive(
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

describe('work items', () => {
  it('lists them dependencies first', () => {
    const model = modelOf(load());
    const order = workOrdered(model).map((w) => w.id);
    expect(order.indexOf('wi:dispatch-field')).toBeLessThan(order.indexOf('wi:publish-v2'));
    expect(order.indexOf('wi:publish-v2')).toBeLessThan(order.indexOf('wi:shop-date'));
    expect(
      workOrdered(model, (w) => w.team === 'team:orders').every((w) => w.team === 'team:orders'),
    ).toBe(true);
  });

  it('has no state before delivery begins', () => {
    const model = modelOf(load());
    expect(wiState(model, 'wi:publish-v2')).toBeNull();
    const facts = workFacts(model, workById(model, 'wi:dispatch-field')!, () => 'M1');
    expect(facts.startsWith('||S|M1')).toBe(true);
  });

  it('reads done, open and not started from the issues', () => {
    const model = inDelivery();
    expect(wiState(model, 'wi:dispatch-field')).toBe('done');
    expect(wiState(model, 'wi:publish-v2')).toBe('open');
    expect(wiState(model, 'wi:shop-date')).toBe('not-started');
    expect(wiState(model, 'wi:nothing')).toBeNull();
    const facts = workFacts(model, workById(model, 'wi:dispatch-field')!, () => 'M1');
    expect(facts.startsWith('done|#41|S|M1')).toBe(true);
  });

  it('links an issue from the status file, else from the repo', () => {
    const model = inDelivery();
    const open = workById(model, 'wi:publish-v2')!;
    expect(issueNumber(open)).toBe('#42');
    expect(issueUrl(model, open)).toBe('https://github.com/acme/products/issues/42');
    const closed = workById(model, 'wi:dispatch-field')!;
    expect(issueUrl(model, closed)).toBe('https://github.com/acme/products/issues/41');
    const unfiled = workById(model, 'wi:shop-date')!;
    expect(issueNumber(unfiled)).toBe('');
    expect(issueUrl(model, unfiled)).toBeNull();
  });

  it('finds what depends on an item, and the critical path', () => {
    const model = modelOf(load());
    expect(dependentsOf(model, 'wi:dispatch-field').map((w) => w.id)).toContain('wi:publish-v2');
    expect([...criticalSet(model)].toSorted((a, b) => a.localeCompare(b))).toEqual([
      'wi:dispatch-field',
      'wi:orders-v2',
      'wi:publish-v2',
      'wi:retire-v1',
    ]);
    expect(milestoneById(model, 'ms:m1')?.name).toContain('M1');
    expect(milestoneById(model)).toBeUndefined();
  });

  it('orders teams by lane, each once', () => {
    const model = modelOf(load());
    const teams = orderTeams(model, ['team:catalogue', 'team:orders', 'team:catalogue']);
    expect(teams).toHaveLength(2);
    expect(
      teams.map((t) => teamSlot(model, { ...workById(model, 'wi:shop-date')!, team: t })),
    ).toEqual(
      teams
        .map((t) => teamSlot(model, { ...workById(model, 'wi:shop-date')!, team: t }))
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
  it('says "When M1 is done" before delivery, with a due date', () => {
    const model = modelOf(load());
    const st = msState(model, 'ms:m1', TODAY)!;
    expect(st.started).toBe(false);
    expect(st.text).toBe('When M1 is done');
    expect(st.dueText).toBe('due 13 Nov');
    expect(st.late).toBe(true);
    expect(st.title).toBe('Dates exist');
    expect(chipSummary(st)).toBe('due 13 Nov');
    expect(msFacts(st)).toBe('ms:m1|When M1 is done|due 13 Nov|due date passed');
    expect(msState(model, 'ms:nothing', TODAY)).toBeNull();
  });

  it('counts done items in delivery', () => {
    const model = inDelivery();
    const st = msState(model, 'ms:m1', TODAY)!;
    expect(st.started).toBe(true);
    expect(st.done).toBe(1);
    expect(st.text).toBe(`1 of ${String(st.total)} done`);
    expect(chipSummary(st)).toBe(st.text);
    expect(st.allDone).toBe(false);
  });

  it('says when every item is done and when it finished', () => {
    const plan = load();
    const ids = plan.work_items!.filter((w) => w.milestone === 'ms:m1').map((w) => w.id);
    const work = plan.work_items!.map((w) => (ids.includes(w.id) ? { ...w, github_issue: 7 } : w));
    const status = Object.fromEntries(
      ids.map((id) => [id, { state: 'closed' as const, closed_at: '2026-11-09T08:00:00Z' }]),
    );
    const model = derive({ ...plan, work_items: work }, { status });
    const st = msState(model, 'ms:m1', TODAY)!;
    expect(st.allDone).toBe(true);
    expect(st.late).toBe(false);
    expect(st.text).toBe('M1 done 9 Nov');
    expect(chipSummary(st)).toBe('done 9 Nov');
  });

  it('sums the build', () => {
    const before = buildSummary(modelOf(load()), TODAY);
    expect(before.started).toBe(false);
    expect(before.current).toBeNull();
    expect(before.delivered).toBe(false);
    expect(before.total).toBe(before.items.length);
    const model = inDelivery();
    const after = buildSummary(model, TODAY);
    expect(after.started).toBe(true);
    expect(after.done).toBe(1);
    expect(after.todo).toHaveLength(after.total - 1);
    expect(after.current?.id).toBe('ms:m1');
    expect(after.left.every((w) => w.milestone === 'ms:m1')).toBe(true);
    expect(after.pathTeams).toEqual(expect.arrayContaining(['team:catalogue', 'team:orders']));
  });
});

describe('gates', () => {
  it('draws a question or a proposed decision, and nothing else', () => {
    const plan = load();
    const question = plan.questions![0]!;
    const model = derive({
      ...plan,
      decisions: [
        {
          id: 'dec:wait',
          title: 'Pick a region',
          status: 'proposed',
          decider: 'team:catalogue',
          decide_by: '2026-11-10',
        },
      ],
    });
    const q = gateOf(model, question.id, TODAY)!;
    expect(q.decision).toBe(false);
    expect(q.aria).toContain('question');
    const d = gateOf(model, 'dec:wait', TODAY)!;
    expect(d.decision).toBe(true);
    expect(d.decider).toBe('team:catalogue');
    expect(d.dateText).toBe('10 Nov');
    expect(d.late).toBe(false);
    expect(d.aria).toContain('proposed decision: Pick a region, decided by Catalogue, by 10 Nov');
    expect(gateOf(model, 'wi:publish-v2', TODAY)).toBeNull();
  });

  it('flags an open question past its date', () => {
    const plan = load();
    const model = derive({
      ...plan,
      questions: [
        {
          id: 'q:late',
          question: 'Which one?',
          status: 'open',
          decider: 'team:catalogue',
          decide_by: '2026-11-01',
        },
      ],
    });
    const gate = gateOf(model, 'q:late', TODAY)!;
    expect(gate.late).toBe(true);
    expect(gate.aria).toContain('overdue');
  });
});
