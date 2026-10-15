import { describe, expect, it, vi } from 'vitest';

import { applyOps } from '@/application/plan/apply-ops';
import { derive } from '@/application/plan/derive';
import type { Rec } from '@/application/plan/ids';
import type { Change, Plan, Question } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const mini = async (): Promise<Plan> => loadFixture('mini.yaml');

function byId<T extends { id: string }>(list: T[] | undefined, id: string): T {
  const found = list?.find((x) => x.id === id);
  if (found === undefined) throw new Error(`no ${id} in the fixture`);
  return found;
}
const addOps = (c: Change, ...ops: Rec[]): void => {
  c.ops.push(...(ops as unknown as Change['ops']));
};
const asQuestion = (q: Rec): Question => q as unknown as Question;

const m = derive(await mini());
const summaries = (id: string) => m.diff(id).map((e) => e.summary);
const edgeKeys = (list: ReturnType<typeof m.edges>) =>
  list
    .map((e) =>
      [`${e.kind} ${e.from}->${e.to}`, e.via ?? '', e.mode ?? ''].filter((x) => x !== '').join(' '),
    )
    .toSorted((a, b) => a.localeCompare(b));

describe('applyOps', () => {
  it('is pure and applies ops in ledger order', async () => {
    const plan = await mini();
    const snapshot = JSON.stringify(plan);
    const { system, records } = applyOps(plan, plan.changes);
    expect(JSON.stringify(plan)).toBe(snapshot);
    const cancel = byId(system.flows, 'flow:cancel');
    expect(cancel.steps.map((s) => s.id.split('#')[1])).toEqual([
      'request',
      'publish',
      'publish-v2',
      'to-billing',
      'to-analytics',
    ]);
    expect(cancel.steps[3]?.via).toBe('msg:status-changed-v2');
    expect(byId(system.flows, 'flow:billing-run').steps[1]?.id).toBe(
      'flow:billing-run#log-skipped',
    );
    expect(byId(system.messages, 'msg:status-changed-v1').consumers).toEqual(['svc:billing']);
    expect(records).toHaveLength(16);
    const set = records.find((r) => r.target === 'sch:subscription#status');
    expect(set?.props[0]).toEqual({
      prop: 'type',
      change: 'set',
      before: 'enum(active, cancelled)',
      after: 'enum(active, paused, cancelled)',
    });
  });
});

describe('status and rollup', () => {
  it('gives every id its status', () => {
    expect(m.status('svc:web')).toBe('existing');
    expect(m.status('msg:status-changed-v2')).toBe('added');
    expect(m.status('flow:pause#request')).toBe('added');
    expect(m.status('sch:subscription#status')).toBe('modified');
    expect(m.status('msg:status-changed-v1')).toBe('deprecated');
    expect(m.status('flow:cancel#legacy-email')).toBe('removed');
    expect(m.status('nope:x')).toBeNull();
  });
  it('counts changed things inside containers', () => {
    expect(m.rollup('flow:cancel')).toEqual({
      added: 1,
      modified: 2,
      deprecated: 0,
      removed: 1,
      total: 4,
    });
    expect(m.rollup('sch:subscription')).toEqual({
      added: 1,
      modified: 1,
      deprecated: 0,
      removed: 0,
      total: 2,
    });
    expect(m.rollup('if:subs-rest').added).toBe(1);
    expect(m.rollup('team:web').total).toBe(0);
    expect(m.rollup('svc:subs').deprecated).toBeGreaterThanOrEqual(1);
    expect(m.rollup('team:subs').total).toBe(m.rollup('svc:subs').total);
  });
});

describe('diff summaries', () => {
  it('says a field type change and a field add', () => {
    expect(summaries('sch:subscription')).toEqual([
      'status: enum(active, cancelled) → enum(active, paused, cancelled)',
      '+ pause_until date?',
    ]);
  });
  it('collapses versions in a via change', () => {
    expect(summaries('flow:cancel#to-billing')).toEqual(['via v1 → v2']);
  });
  it('names the predecessor of an inserted step', () => {
    expect(summaries('flow:billing-run')[0]).toBe('+ step "Log skipped" after "Select due"');
  });
  it('says deprecate, drop, append and remove', () => {
    expect(summaries('msg:status-changed-v1')).toEqual([
      '− deprecated v1 → v2',
      '− consumers: Analytics',
    ]);
    expect(summaries('st:billing-db')).toEqual(['+ access: Subscriptions read']);
    expect(summaries('flow:cancel')).toContain('× step "Queue legacy email"');
  });
  it('lists the ops of a change with before and after', () => {
    const d = m.diff('chg:status-event-v2');
    expect(d).toHaveLength(5);
    const via = d.find((e) => e.prop === 'via');
    expect(via?.before).toBe('msg:status-changed-v1');
    expect(via?.after).toBe('msg:status-changed-v2');
    expect(via?.path).toBe('changes[1].ops[3]');
    expect(m.opSummary('chg:status-event-v2', 3)).toBe('via v1 → v2');
  });
});

describe('versions and ladder', () => {
  it('pairs versions', () => {
    expect(m.versions('msg:status-changed-v1')).toEqual({
      supersedes: null,
      replacedBy: 'msg:status-changed-v2',
    });
    expect(m.versions('msg:status-changed-v2')).toEqual({
      supersedes: 'msg:status-changed-v1',
      replacedBy: null,
    });
  });
  it('climbs expand, migrate per consumer, contract', () => {
    const l = m.ladder('msg:status-changed-v2');
    expect(l.chain).toEqual(['msg:status-changed-v1', 'msg:status-changed-v2']);
    expect(
      l.rungs.map((r) => [r.rung, r.consumer].filter((x) => x !== undefined && x !== '').join(':')),
    ).toEqual(['expand', 'migrate:svc:billing', 'migrate:svc:analytics', 'contract']);
    const analytics = l.rungs.find((r) => r.consumer === 'svc:analytics');
    expect(analytics?.workItems).toEqual(['wi:analytics-v2']);
    expect(analytics?.teams).toContain('team:platform');
  });
  it('calls a deprecate "marked deprecated (still published)", not retired', () => {
    const l = m.ladder('msg:status-changed-v1');
    expect(l.rungs.map((r) => `${r.rung}/${r.kind}`)).toEqual([
      'expand/expand',
      'migrate/migrate',
      'migrate/migrate',
      'contract/deprecate',
    ]);
    expect(l.rungs[3]?.label).toBe('v1 marked deprecated (still published)');
    expect(l.rungs[0]?.label).toBe('v2 published next to v1');
    expect(l.rungs[1]?.label).toBe('Billing moves to v2');
    expect(l.retired).toBe(false);
  });
  it('retires only on a remove op', async () => {
    const p = await mini();
    addOps(byId(p.changes, 'chg:analytics-v2'), {
      modify: 'flow:cancel#publish',
      set: { via: 'msg:status-changed-v2' },
    });
    addOps(byId(p.changes, 'chg:retire-email'), { remove: 'msg:status-changed-v1' });
    const l = derive(p).ladder('msg:status-changed-v2');
    const contract = l.rungs.filter((r) => r.rung === 'contract');
    expect(contract.map((r) => r.kind)).toEqual(['deprecate', 'retire']);
    expect(contract[1]?.label).toBe('v1 removed');
    expect(contract[1]?.workItems).toEqual(['wi:retire']);
    expect(l.retired).toBe(true);
  });
});

describe('edges', () => {
  it('draws as-is message edges: producer, topic, consumers, with steps', () => {
    expect(edgeKeys(m.edges('asIs', 'msg'))).toEqual([
      'msg st:sub-events->svc:analytics msg:status-changed-v1',
      'msg st:sub-events->svc:billing msg:status-changed-v1',
      'msg svc:subs->st:sub-events msg:status-changed-v1',
    ]);
    const pub = m.edges('asIs', 'msg').find((e) => e.from === 'svc:subs');
    expect(pub?.steps).toEqual(['flow:cancel#publish']);
  });
  it('makes api edges sync and carries steps', () => {
    const api = m.edges('toBe', 'api');
    expect(edgeKeys(api)).toEqual([
      'api svc:web->svc:subs api:subs-cancel',
      'api svc:web->svc:subs api:subs-pause',
    ]);
    expect(api.every((e) => e.sync)).toBe(true);
  });
  it('merges owner, access and step reads and writes into data edges', () => {
    expect(edgeKeys(m.edges('asIs', 'data'))).toEqual([
      'data svc:analytics->st:billing-db read',
      'data svc:billing->st:billing-db readwrite',
      'data svc:subs->st:subs-db readwrite',
    ]);
  });
  it('shows nothing for none and every kind for all', () => {
    expect(m.edges('toBe', 'none')).toEqual([]);
    expect(m.edges('toBe', 'all')).toHaveLength(
      m.edges('toBe', 'api').length +
        m.edges('toBe', 'msg').length +
        m.edges('toBe', 'data').length,
    );
  });
  it('marks added, removed and deprecated edges in diff mode', () => {
    const d = m.edges('diff', 'msg');
    const s = (from: string, to: string, via: string) =>
      d.find((e) => e.from === from && e.to === to && e.via === via)?.status;
    expect(s('st:sub-events', 'svc:analytics', 'msg:status-changed-v2')).toBe('added');
    expect(s('st:sub-events', 'svc:analytics', 'msg:status-changed-v1')).toBe('removed');
    expect(s('svc:subs', 'st:sub-events', 'msg:status-changed-v1')).toBe('deprecated');
  });
  it('returns the same array on repeat calls', () => {
    expect(m.edges('toBe', 'all')).toBe(m.edges('toBe', 'all'));
  });
});

describe('store grid and message and api lookups', () => {
  it('builds the store grid', () => {
    const g = m.storeGrid('asIs');
    expect(g.stores).toEqual(['st:subs-db', 'st:billing-db']);
    expect(g.cell('svc:analytics', 'st:billing-db')?.mode).toBe('read');
    expect(g.cell('svc:billing', 'st:billing-db')?.owner).toBe(true);
    expect(g.shared).toEqual(['st:billing-db']);
    expect(m.storeGrid('toBe').cell('svc:subs', 'st:billing-db')).toBeTruthy();
  });
  it('finds callers, publish points and effective consumers', () => {
    expect(m.callers('api:subs-pause')).toEqual([
      { step: 'flow:pause#request', flow: 'flow:pause', from: 'svc:web' },
    ]);
    expect(m.publishPoints('msg:status-changed-v2').map((p) => p.step)).toEqual([
      'flow:cancel#publish-v2',
      'flow:pause#publish',
    ]);
    expect(m.consumersEffective('msg:status-changed-v2').map((c) => c.svc)).toEqual([
      'svc:billing',
      'svc:analytics',
    ]);
    expect(m.consumersEffective('msg:status-changed-v1', 'asIs').map((c) => c.svc)).toEqual([
      'svc:billing',
      'svc:analytics',
    ]);
  });
});

describe('coverage and spans', () => {
  it('builds the coverage matrix and its gaps', () => {
    const c = m.coverage();
    expect(c.levels).toEqual(['unit', 'service', 'contract', 'integration', 'e2e']);
    const row = c.rows.find((r) => r.change === 'chg:pause-api');
    expect(row?.byLevel.contract).toEqual(['tst:pause-contract']);
    expect(row?.envs.toSorted()).toEqual(['ci', 'staging']);
    expect(c.gaps.unitOnly).toEqual(['chg:skip-paused']);
    expect(c.gaps.untested).toEqual([]);
    expect(c.gaps.noE2e).toContain('chg:retire-email');
  });
  it('brackets steps with test spans', () => {
    expect(m.spans('flow:pause').map((s) => [s.test, s.fromIndex, s.toIndex, s.whole])).toEqual([
      ['tst:pause-e2e', 0, 1, true],
      ['tst:pause-contract', 0, 0, false],
    ]);
    expect(m.spans('flow:cancel').map((s) => [s.test, s.from, s.to])).toEqual([
      ['tst:analytics-v2', 'flow:cancel#publish-v2', 'flow:cancel#to-analytics'],
    ]);
    expect(m.spans('flow:cancel', 'asIs').map((s) => s.test)).toEqual([
      'tst:analytics-v2',
      'tst:no-email',
    ]);
  });
  it('has every walking test walk something its changes touch', () => {
    expect(m.coverage().gaps.provesWithoutWalking).toEqual([]);
  });
  it('flags a test proving a change it never walks', async () => {
    const p = await mini();
    byId(p.tests, 'tst:analytics-v2').proves.push('chg:skip-paused');
    const d = derive(p);
    expect(d.coverage().gaps.provesWithoutWalking).toEqual([
      { test: 'tst:analytics-v2', change: 'chg:skip-paused' },
    ]);
    expect(d.health().provesWithoutWalking).toBe(1);
  });
  it('counts walking a whole flow for every step, and exempts tests without walks', async () => {
    const p = await mini();
    const t = byId(p.tests, 'tst:analytics-v2');
    t.walks = ['flow:billing-run'];
    t.proves = ['chg:skip-paused'];
    byId(p.tests, 'tst:v2-unit').proves.push('chg:retire-email');
    expect(derive(p).coverage().gaps.provesWithoutWalking).toEqual([]);
  });
  it('lists new or re-routed cross-service connections without a contract test', () => {
    const gaps = m.coverage().gaps.connectionsWithoutContract;
    expect(gaps.map((c) => `${c.from}->${c.to} ${c.via} ${c.reason}`)).toEqual([
      'svc:subs->svc:billing msg:status-changed-v2 via-changed',
      'svc:subs->svc:analytics msg:status-changed-v2 via-changed',
    ]);
    expect(gaps[0]?.steps).toEqual(['flow:cancel#to-billing']);
    expect(m.health().connectionsWithoutContract).toBe(2);
  });
  it('lets a contract test walking the flow cover its steps', async () => {
    const p = await mini();
    p.tests = [
      ...(p.tests ?? []),
      {
        id: 'tst:cancel-contract',
        level: 'contract',
        name: 'v2 contract',
        proves: ['chg:analytics-v2'],
        walks: ['flow:cancel'],
      },
    ];
    expect(derive(p).coverage().gaps.connectionsWithoutContract).toEqual([]);
  });
});

describe('teams', () => {
  it('names the teams of a change', () => {
    expect(m.teamsOf('chg:status-event-v2')).toEqual(['team:subs', 'team:billing']);
    expect(m.teamsOf('chg:skip-paused')).toEqual(['team:billing']);
  });
  it('cuts the plan for a team', () => {
    const cut = m.teamCut('team:billing');
    expect(cut.services).toEqual(['svc:billing']);
    expect(cut.workItems).toEqual(['wi:billing-v2', 'wi:skip']);
    expect(cut.has('flow:billing-run')).toBe(true);
    expect(cut.has('chg:skip-paused')).toBe(true);
    expect(cut.has('flow:pause')).toBe(false);
  });
});

describe('delivery', () => {
  it('weights sizes XS=1 to XL=5 on the critical path', () => {
    expect(m.criticalPath()).toEqual({
      path: ['wi:v2-event', 'wi:analytics-v2', 'wi:retire'],
      weight: 8,
    });
  });
  it('puts dependencies first in topoOrder', () => {
    const order = m.topoOrder();
    expect(order).toHaveLength(6);
    for (const w of m.plan.work_items ?? []) {
      for (const d of w.depends_on ?? [])
        expect(order.indexOf(d)).toBeLessThan(order.indexOf(w.id));
    }
  });
  it('groups work into waves', () => {
    expect(
      m
        .waves()
        .flat()
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(m.topoOrder().toSorted((a, b) => a.localeCompare(b)));
  });
  it('finds milestone violations', async () => {
    expect(m.milestoneViolations()).toEqual([]);
    const p = await mini();
    const [first] = p.work_items ?? [];
    if (first) first.depends_on = ['wi:skip'];
    expect(derive(p).milestoneViolations()).toEqual([
      {
        workItem: 'wi:pause-endpoint',
        dependsOn: 'wi:skip',
        milestone: 'ms:skeleton',
        dependsOnMilestone: 'ms:migrate',
      },
    ]);
  });
});

describe('inverse and story refs', () => {
  it('finds inverse links', () => {
    const inv = m.inverse('msg:status-changed-v1');
    expect(inv.risks).toEqual(['risk:v1-consumer']);
    expect(inv.decisions).toEqual(['dec:version-event']);
    expect(inv.steps).toContain('flow:cancel#publish');
    expect(inv.changes).toEqual(['chg:status-event-v2', 'chg:analytics-v2']);
    expect(m.inverse('chg:pause-api').questions).toEqual(['q:trial-pause']);
    expect(m.inverse('flow:pause').scenarios).toEqual(['sc:trip']);
    expect(m.inverse('flow:pause').citedBy).toEqual(['problem.summary']);
  });
  it('gives the chapters of the story', () => {
    expect(m.storyRefs('flow:billing-run')).toEqual(['runs', 'changes']);
    expect(m.storyRefs('flow:pause')).toEqual(['new']);
    expect(m.storyRefs('svc:web')).toEqual(['today', 'runs']);
    expect(m.storyRefs('sch:subscription')).toEqual(['today', 'runs', 'changes']);
    expect(m.storyRefs('chg:pause-api')).toEqual(['changes']);
    expect(m.storyRefs('tst:pause-e2e')).toEqual(['prove']);
    expect(m.storyRefs('wi:skip')).toEqual(['build']);
    expect(m.storyRefs('q:trial-pause')).toEqual(['commit']);
    expect(m.storyRefs('risk:v1-consumer')).toEqual(['commit']);
    expect(m.inverse('flow:pause').story).toEqual(['new']);
  });
});

describe('health', () => {
  it('counts what the plan holds', () => {
    const h = m.health();
    expect(h.changes).toBe(5);
    expect(h.tests).toBe(6);
    expect(h.workItems).toBe(6);
    expect(h.untested).toBe(0);
    expect(h.openQuestions).toBe(1);
    expect(h.errors).toBe(0);
    expect(h.warnings).toBe(1);
  });
  it('tolerates a broken plan', async () => {
    const p = await mini();
    const [c] = p.changes ?? [];
    if (c) {
      addOps(
        c,
        { modify: 'svc:ghost', set: { name: 'x' } },
        { add: 'step', into: 'flow:ghost', value: {} },
      );
    }
    const items = p.work_items ?? [];
    if (items[0]) items[0].depends_on = ['wi:retire'];
    items[5]?.depends_on?.push('wi:pause-endpoint');
    const d = derive(p);
    expect(d.health().errors).toBeGreaterThan(0);
    expect(d.topoOrder()).toHaveLength(6);
    expect(Array.isArray(d.criticalPath().path)).toBe(true);
  });
  it('reuses a supplied validation instead of re-running the validator', async () => {
    const validation = {
      errors: [],
      warnings: [
        { path: 'x', message: 'y' },
        { path: 'x', message: 'z' },
      ],
    };
    const d = derive(await mini(), { validation });
    expect(d.validation()).toBe(validation);
    expect(d.health().warnings).toBe(2);
  });
});

describe('blockers and overdue', () => {
  it('blocks a work item through the item, its changes, or their op targets', async () => {
    expect(m.blockersOf('wi:pause-endpoint')).toEqual(['q:trial-pause']);
    expect(m.blockersOf('wi:skip')).toEqual([]);
    const p = await mini();
    p.questions = [
      ...(p.questions ?? []),
      asQuestion({
        id: 'q:target',
        question: 'Which status names?',
        decider: 'team:billing',
        decide_by: '2026-10-05',
        status: 'open',
        blocks: ['sch:subscription#status'],
      }),
      asQuestion({
        id: 'q:direct',
        question: 'Who skips?',
        decider: 'team:billing',
        status: 'open',
        blocks: ['wi:skip'],
      }),
      asQuestion({
        id: 'q:done',
        question: 'Done?',
        decider: 'team:billing',
        status: 'resolved',
        answer: 'yes',
        blocks: ['wi:skip'],
      }),
    ];
    const d = derive(p);
    expect(d.blockersOf('wi:pause-endpoint')).toEqual(['q:target', 'q:trial-pause']);
    expect(d.blockersOf('wi:skip')).toEqual(['q:direct']);
    expect(d.blockersOf('ms:skeleton')).toEqual(['q:target', 'q:trial-pause']);
    expect(d.blockersOf('ms:migrate')).toEqual(['q:direct']);
    expect(d.blockersOf('chg:pause-api')).toEqual([]);
  });
  it('compares decide_by with today', () => {
    const q = byId(m.plan.questions, 'q:trial-pause');
    expect(m.overdue(q, '2026-10-10')).toBe(false);
    expect(m.overdue(q, '2026-10-11')).toBe(true);
    expect(m.overdue('q:trial-pause', new Date(2026, 9, 11))).toBe(true);
    expect(m.overdue({ ...q, status: 'resolved' }, '2027-01-01')).toBe(false);
    expect(m.overdue({ status: 'open' }, '2027-01-01')).toBe(false);
  });
});

describe('tracker status', () => {
  it('reads statusOf and milestoneProgress from the status map', async () => {
    const closed = {
      state: 'closed',
      closed_at: '2026-10-03T10:00:00Z',
      url: 'https://github.com/org/subs/issues/1',
    } as const;
    const d = derive(await mini(), {
      status: { 'wi:pause-endpoint': closed, 'wi:v2-event': { state: 'open' } },
    });
    expect(d.statusOf('wi:pause-endpoint')).toEqual(closed);
    expect(d.statusOf('wi:v2-event')).toEqual({ state: 'open', closed_at: null, url: null });
    expect(d.statusOf('wi:skip')).toBeNull();
    expect(d.milestoneProgress('ms:skeleton')).toEqual({ done: 1, total: 2 });
    expect(d.milestoneProgress('ms:migrate')).toEqual({ done: 0, total: 3 });
    expect(m.milestoneProgress('ms:skeleton')).toEqual({ done: 0, total: 2 });
  });
});

describe('ops on ids the plan adds', () => {
  it('keeps added-then-modified as added, and the diff shows the modification', async () => {
    const p = await mini();
    addOps(byId(p.changes, 'chg:analytics-v2'), {
      modify: 'msg:status-changed-v2',
      set: { semantics: 'at-least-once, keyed by subscription_id' },
    });
    const d = derive(p);
    expect(d.status('msg:status-changed-v2')).toBe('added');
    expect(
      d
        .diff('msg:status-changed-v2')
        .some(
          (e) => e.kind === 'modify' && e.summary.startsWith('semantics: (none) → at-least-once'),
        ),
    ).toBe(true);
  });
});
