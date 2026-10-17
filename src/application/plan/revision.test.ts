import { describe, expect, it, vi } from 'vitest';

import { settledPauseOrders } from '@/../test/fixtures/acme/plans/core-settled';
import { giftWrapVersioned } from '@/../test/fixtures/acme/plans/versions-gift-wrap';
import { buildRevision } from '@/application/plan/revision';
import {
  diffEntry,
  findEntity,
  pillText,
  snapshotsWanted,
  wantsApproved,
} from '@/application/plan/revision-view';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const FIRST = {
  version: '1.0',
  status: 'approved',
  date: '2026-09-20',
  approved_on: '2026-09-25',
  approved_by: '@priya-shah',
} as const;

function byId<T extends { id: string }>(items: T[] | undefined, id: string): T {
  const found = items?.find((x) => x.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
}

/** [approved 1.0, head 1.1 proposed]: the head adds a work item and renames another. */
async function pair(): Promise<{ approved: Plan; head: Plan }> {
  const approved = await loadFixture('mini.yaml');
  const head = await loadFixture('mini.yaml');
  approved.work_items = (approved.work_items ?? []).filter((w) => w.id !== 'wi:skip');
  byId(approved.work_items, 'wi:v2-event').title = 'Publish the v2 event';
  approved.meta.revisions = [FIRST];
  head.meta.version = '1.1';
  head.meta.revisions = [
    FIRST,
    {
      version: '1.1',
      status: 'proposed',
      date: '2026-10-01',
      summary: 'Add the skip.',
      by: ['team:billing'],
      pr: 41,
    },
  ];
  return { approved, head };
}

const second = (head: Plan) => {
  const entry = head.meta.revisions?.[1];
  if (entry === undefined) throw new Error('no second revision');
  return entry;
};

async function history() {
  const { approved, head } = await pair();
  const old = structuredClone(approved);
  old.meta.version = '0.9';
  head.meta.revisions = [
    { version: '0.9', status: 'approved', date: '2026-09-01', approved_on: '2026-09-02' },
    FIRST,
    { version: '1.05', status: 'rejected', date: '2026-09-28', summary: 'Nope' },
    ...(head.meta.revisions?.slice(1) ?? []),
  ];
  return { approved, head, old };
}

describe('buildRevision', () => {
  it('a proposed head with a snapshot: head view, diff approved → head', async () => {
    const { approved, head } = await pair();
    const r = buildRevision(head, approved);
    expect([r.viewing, r.head.version, r.head.status, r.approved?.version]).toEqual([
      'head',
      '1.1',
      'proposed',
      '1.0',
    ]);
    expect(r.diff?.workItems.added).toEqual(['wi:skip']);
    expect(
      r.diff?.entities.work_items?.changed.some(
        (c) => c.id === 'wi:v2-event' && c.keys.includes('title'),
      ),
    ).toBe(true);
    expect(r.ledger).toHaveLength(2);
  });

  it('viewing the approved version keeps the diff; an unknown version falls back to the head', async () => {
    const { approved, head } = await pair();
    expect(buildRevision(head, approved, { viewing: '1.0' }).viewing).toBe('1.0');
    expect(buildRevision(head, approved, { viewing: '9.9' }).viewing).toBe('head');
    expect(buildRevision(head, approved, { viewing: '1.0' }).diff?.workItems.added[0]).toBe(
      'wi:skip',
    );
    expect(buildRevision(head, approved, { viewing: '1.0' }).viewed.plan).toBe(approved);
  });

  it('no snapshot: no diff, no switch to the approved version', async () => {
    const { head } = await pair();
    const r = buildRevision(head, null, { viewing: '1.0' });
    expect([r.diff, r.viewing]).toEqual([null, 'head']);
  });

  it('an approved head has no diff and nothing to fetch unless asked', async () => {
    const { head } = await pair();
    second(head).status = 'approved';
    expect(buildRevision(head, null).head.status).toBe('approved');
    expect(buildRevision(head, null).diff).toBeNull();
    expect(buildRevision(head, null).approved?.plan).toBe(head);
    expect(wantsApproved(head, null)).toBe(false);
    expect(wantsApproved(head, '1.1')).toBe(true);
    expect(wantsApproved(await loadFixture('mini.yaml'), null)).toBe(false);
  });

  it('a plan without a ledger has no status and no approved revision', async () => {
    const r = buildRevision(await loadFixture('mini.yaml'));
    expect([r.head.status, r.approved, r.ledger]).toEqual(['none', null, []]);
    expect(r.head.version).toBe('1.0');
  });

  it('diffEntry names the collection and kind', async () => {
    const { approved, head } = await pair();
    const { diff } = buildRevision(head, approved);
    expect(diffEntry(diff, 'wi:skip')).toEqual({ key: 'work_items', kind: 'added' });
    expect(diffEntry(diff, 'wi:v2-event')?.kind).toBe('changed');
    expect(diffEntry(diff, 'svc:web')).toBeNull();
    expect(diffEntry(null, 'wi:skip')).toBeNull();
  });

  it('the pill, and which snapshots to read', async () => {
    const { approved, head } = await pair();
    expect(pillText(head, buildRevision(head, approved))).toBe('1.1 proposed');
    expect(pillText(approved, buildRevision(head, approved, { viewing: '1.0' }))).toBe('1.0');
    expect(pillText(await loadFixture('mini.yaml'))).toBe('');
    expect(pillText(approved)).toBe('1.0');
    expect(pillText(head)).toBe('1.1 proposed');
    expect(snapshotsWanted(head, '1.1')).toEqual({ approved: '1.0', older: null });
    expect(snapshotsWanted(head, '7.0')).toEqual({ approved: '1.0', older: null });
  });

  it('findEntity looks through collections, scenarios and concepts', async () => {
    const plan = await loadFixture('mini.yaml');
    expect(findEntity(plan, 'wi:skip')?.id).toBe('wi:skip');
    expect(findEntity(plan, 'svc:subs')?.id).toBe('svc:subs');
    expect(findEntity(plan, 'nope')).toBeNull();
    expect(findEntity(null, 'wi:skip')).toBeNull();
    expect(findEntity(plan, '')).toBeNull();
  });
});

describe('an earlier revision', () => {
  it('reads as it was, without the proposal diff; the history says what can be opened', async () => {
    const { approved, head, old } = await history();
    const r = buildRevision(head, approved, {
      viewing: '0.9',
      older: { version: '0.9', plan: old },
      snapshots: ['0.9', '1.0'],
    });
    expect(r.viewing).toBe('0.9');
    expect(r.viewed.plan).toBe(old);
    expect(r.diff).toBeNull();
    expect(
      r.history.map((h) => `${h.version}:${h.available ? 'y' : 'n'}${h.current ? '*' : ''}`),
    ).toEqual(['1.1:y', '1.05:n', '1.0:y', '0.9:y*']);
    expect(pillText(old, r)).toBe('0.9');
  });

  it('without its snapshot the head is shown, and the caller learns what to read', async () => {
    const { approved, head } = await history();
    expect(buildRevision(head, approved, { viewing: '0.9' }).viewing).toBe('head');
    expect(snapshotsWanted(head, '0.9')).toEqual({ approved: '1.0', older: '0.9' });
  });

  it('a rejected revision compares with the approved one it was proposed on', async () => {
    const { approved, head } = await pair();
    const rejected = structuredClone(head);
    second(head).status = 'rejected';
    head.meta.revisions?.push({
      version: '1.2',
      status: 'proposed',
      date: '2026-10-02',
      summary: 'Again',
    });
    head.meta.version = '1.2';
    const r = buildRevision(head, approved, { plans: { '1.1': rejected } });
    expect(r.steps.map((s) => `${s.version}<${String(s.base)}`)).toEqual([
      '1.2<1.0',
      '1.1<1.0',
      '1.0<null',
    ]);
    expect(r.diffOf('1.1')?.workItems.added).toContain('wi:skip');
    expect(r.diffOf('1.1')).toBe(r.diffOf('1.1'));
    expect(r.diffOf('1.0')).toBeNull();
    expect(pillText(head, r)).toBe('1.2 proposed');
  });
});

const PLANS = {
  'gift-wrap': () => giftWrapVersioned(),
  'pause-orders': settledPauseOrders,
};

describe('a plan with revisions on Acme', () => {
  it.each(Object.keys(PLANS) as (keyof typeof PLANS)[])(
    '%s: reads its snapshots and builds',
    (slug) => {
      const { plan: head, snapshots } = PLANS[slug]();
      const versions = Object.keys(snapshots);
      const want = snapshotsWanted(head, 'head');
      const read = want.approved === null ? null : (snapshots[want.approved] ?? null);
      const r = buildRevision(head, read, { snapshots: versions });
      expect(r.ledger.length).toBeGreaterThan(0);
      expect(r.history.every((h) => h.available || !versions.includes(h.version))).toBe(true);
      const seen = {
        status: r.head.status,
        approved: r.approved?.version,
        diffEmpty: r.diff === null ? null : r.diff.empty,
      };
      const proposed = { status: 'proposed', approved: '1.0', diffEmpty: false };
      const approved = { status: 'approved', approved: '1.0', diffEmpty: null };
      expect(seen).toEqual(slug === 'gift-wrap' ? proposed : approved);
    },
  );
});
