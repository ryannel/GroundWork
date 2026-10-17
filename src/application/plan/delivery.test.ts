import { describe, expect, it, vi } from 'vitest';

import {
  deliveryOf,
  EFFECT,
  impactText,
  isPending,
  proposedOnlyWork,
  stageText,
  workState,
  type DeliveryPlan,
} from '@/application/plan/delivery';
import {
  filedWorkChanged,
  filedWorkTouched,
  proposalImpact,
  proposalWork,
  workTouched,
  type ImpactOf,
} from '@/application/plan/delivery-work';
import { buildRevision } from '@/application/plan/revision';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const FIRST = { version: '1.0', status: 'approved', date: '2026-09-20' } as const;
const NEW_ITEM = { item: 'wi:new', action: 'new' } as const;

const head = (status: 'proposed' | 'approved'): DeliveryPlan => ({
  meta: {
    status: 'approved',
    revisions: [FIRST, { version: '1.1', status, date: '2026-10-01', work: [NEW_ITEM] }],
  },
  work_items: [{ id: 'wi:a', github_issue: 1 }, { id: 'wi:new' }],
});

const plan = (status: string): DeliveryPlan => ({
  meta: { status },
  work_items: [{ id: 'wi:a', github_issue: 7 }, { id: 'wi:b' }],
});

describe('deliveryOf', () => {
  it('leaves out work only a live proposal has; once approved, it counts', () => {
    const d = deliveryOf(head('proposed'), { 'wi:a': { state: 'closed' } });
    expect([d.total, d.stage, d.proposed]).toEqual([1, 'delivered', '1.1']);
    expect([...proposedOnlyWork(head('proposed'))]).toEqual(['wi:new']);
    expect(isPending(d, 'wi:new')).toBe(true);
    expect(isPending(null, 'wi:new')).toBe(false);
    const approved = deliveryOf(head('approved'));
    expect([approved.total, approved.proposed, approved.pending.size]).toEqual([2, null, 0]);
  });

  it('with the approved snapshot, the work only the proposal has is read by id', () => {
    const approvedPlan: DeliveryPlan = { work_items: [{ id: 'wi:a' }] };
    expect([...proposedOnlyWork(head('proposed'), approvedPlan)]).toEqual(['wi:new']);
    expect(proposedOnlyWork({ work_items: [{ id: 'wi:x' }] }).size).toBe(0);
  });

  it('the stage runs draft, in delivery, delivered; committed reads as approved', () => {
    expect(deliveryOf({}).stage).toBe('draft');
    expect(deliveryOf({ meta: { status: 'committed' } }).stage).toBe('approved');
    const open = deliveryOf(plan('approved'), { 'wi:a': { state: 'open' } });
    expect([open.stage, open.filed, open.done, stageText(open)]).toEqual([
      'in-delivery',
      1,
      0,
      'in delivery · 0 of 2 done',
    ]);
    expect(deliveryOf(plan('review')).items.get('wi:a')).toEqual({ issue: '7', state: null });
    expect(stageText(deliveryOf({ meta: { status: 'review' } }))).toBe('review');
    expect(stageText(null)).toBe('');
  });

  it('workState: not started needs an issue elsewhere in the plan', () => {
    const d = deliveryOf(
      { work_items: [{ id: 'wi:a', github_issue: 1 }, { id: 'wi:b' }] },
      { 'wi:a': { state: 'closed' } },
    );
    expect([workState(d, 'wi:a'), workState(d, 'wi:b')]).toEqual(['done', 'not-started']);
    expect(workState(deliveryOf({ work_items: [{ id: 'wi:a' }] }), 'wi:a')).toBeNull();
    expect(workState(null, 'wi:a')).toBeNull();
    const open = deliveryOf(
      { work_items: [{ id: 'wi:a', github_issue: 1 }] },
      { 'wi:a': { state: 'open' } },
    );
    expect(workState(open, 'wi:a')).toBe('open');
  });

  it('says the work in the plan’s words', () => {
    expect(EFFECT.rework[0]).toBe('reopened');
    expect(impactText({ filed: 1, closed: 0 })).toBe('1 work item under way');
    expect(impactText({ filed: 4, closed: 2 })).toBe('4 work items under way, 2 of them done');
    expect(impactText({ filed: 3, closed: 3 })).toBe('3 work items under way, all done');
    expect(impactText({ filed: 1, closed: 1 })).toBe('1 work item under way, already done');
  });
});

async function proposal() {
  const approved = await loadFixture('mini.yaml');
  const proposed = await loadFixture('mini.yaml');
  approved.work_items = (approved.work_items ?? []).filter((w) => w.id !== 'wi:skip');
  const pause = approved.work_items.find((w) => w.id === 'wi:v2-event');
  if (pause === undefined) throw new Error('no wi:v2-event');
  pause.title = 'Publish the v2 event';
  approved.meta.revisions = [FIRST];
  proposed.meta.version = '1.1';
  proposed.meta.revisions = [
    FIRST,
    { version: '1.1', status: 'proposed', date: '2026-10-01', summary: 'Skip.' },
  ];
  return { approved, proposed, revision: buildRevision(proposed, approved) };
}

const impactOf: ImpactOf = ({ diff }) => ({
  work: [
    ...diff.workItems.added.map((id) => ({
      id,
      effect: 'new',
      why: [] as string[],
      authored: true,
    })),
    { id: 'wi:v2-event', effect: 'rework', why: ['its title changes', 'it is reopened'] },
    { id: 'wi:pause-endpoint', effect: 'changes', why: [], note: 'the endpoint grows' },
    { id: 'wi:retire', effect: 'keep', why: [] },
  ],
});

describe('work a revision touches', () => {
  it('names the work it adds and changes, with why', async () => {
    const { approved, revision } = await proposal();
    const touched = workTouched(revision.diff, approved);
    expect(touched).toContainEqual({ id: 'wi:skip', why: 'it is new' });
    expect(touched).toContainEqual({ id: 'wi:v2-event', why: 'its title changes' });
    expect(workTouched(null, approved)).toEqual([]);
  });

  it('a work item building an edited change is touched for it', async () => {
    const { approved, proposed } = await proposal();
    const change = proposed.changes?.find((c) => c.id === 'chg:pause-api');
    if (change === undefined) throw new Error('no chg:pause-api');
    change.title = 'Add the pause endpoint, reworded';
    const { diff } = buildRevision(proposed, approved);
    const touched = workTouched(diff, approved);
    expect(touched.some((t) => t.change === 'chg:pause-api' && t.id === 'wi:pause-endpoint')).toBe(
      true,
    );
  });

  it('only work under way counts as filed', async () => {
    const { approved, proposed, revision } = await proposal();
    expect(filedWorkTouched(revision.diff, approved, deliveryOf(approved))).toEqual([]);
    const withIssue = structuredClone(approved);
    const w = withIssue.work_items?.find((x) => x.id === 'wi:v2-event');
    if (w === undefined) throw new Error('no wi:v2-event');
    w.github_issue = 12;
    const delivery = deliveryOf(withIssue, { 'wi:v2-event': { state: 'closed' } }, withIssue);
    const filed = filedWorkTouched(revision.diff, approved, delivery);
    expect(filed).toEqual([
      { id: 'wi:v2-event', why: 'its title changes', issue: '12', state: 'closed' },
    ]);
    expect(proposed.work_items).toBeDefined();
  });
});

async function underway() {
  const { approved, proposed, revision } = await proposal();
  for (const side of [approved, proposed]) {
    for (const w of side.work_items ?? []) {
      if (w.id === 'wi:v2-event') w.github_issue = 12;
      if (w.id === 'wi:pause-endpoint') w.github_issue = 13;
    }
  }
  const delivery = deliveryOf(approved, {
    'wi:v2-event': { state: 'closed' },
    'wi:pause-endpoint': { state: 'open' },
  });
  return { revision, delivery };
}

describe('a live proposal and the work under way', () => {
  it('lists the filed work it reopens or changes, the proposer’s word first', async () => {
    const { revision, delivery } = await underway();
    const impact = proposalImpact(revision, delivery, impactOf);
    expect(impact).toMatchObject({ version: '1.1', filed: 2, closed: 1 });
    expect(impact?.items.map((i) => [i.id, i.why])).toEqual([
      ['wi:v2-event', 'its title changes; it is reopened'],
      ['wi:pause-endpoint', 'the endpoint grows'],
    ]);
    expect(filedWorkChanged(null, delivery)).toEqual([]);
  });

  it('tags each work item the proposal moves; one impact per revision and delivery', async () => {
    const { revision, delivery } = await underway();
    const spy = vi.fn<typeof impactOf>(impactOf);
    const work = proposalWork(revision, delivery, spy);
    expect(work?.version).toBe('1.1');
    expect(work?.byId.get('wi:skip')).toEqual({ effect: 'new', authored: true, note: null });
    expect(work?.byId.get('wi:pause-endpoint')).toEqual({
      effect: 'changes',
      authored: false,
      note: 'the endpoint grows',
    });
    expect(work?.byId.has('wi:retire')).toBe(false);
    proposalWork(revision, delivery, spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('says nothing without a proposal, or when no filed work changes', async () => {
    const { revision, delivery } = await underway();
    const none = buildRevision(await loadFixture('mini.yaml'));
    expect(proposalImpact(none, delivery, impactOf)).toBeNull();
    expect(proposalWork(none, delivery, impactOf)).toBeNull();
    expect(proposalImpact(revision, deliveryOf({}), impactOf)).toBeNull();
    expect(proposalWork(revision, delivery, () => ({ work: [] }))).toBeNull();
  });
});
