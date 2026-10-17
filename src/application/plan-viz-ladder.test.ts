// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { eventData, sortEvents } from '@/application/plan-viz-events';
import { ladderSummary, versionPair } from '@/application/plan-viz-ladder';
import {
  andList,
  ladderIds,
  msShort,
  sequenceNotes,
  sequencing,
} from '@/application/plan-viz-ladder-order';
import { ladderView } from '@/application/plan-viz-ladder-rungs';

const load = dispatchDate;

describe('ladder words', () => {
  it('lists names the way a sentence does', () => {
    expect(andList([])).toBe('');
    expect(andList(['a'])).toBe('a');
    expect(andList(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('summarises a versioned event', () => {
    const model = modelOf(load());
    expect(ladderIds(model)).toContain('msg:product-changed');
    const s = ladderSummary(model, 'msg:product-changed');
    expect(s?.headline).toBe('`product.changed` goes to v2; two consumers migrate');
    expect(s?.retire).toBe('v1 is removed in M4, once every consumer has moved.');
    expect(s?.deadline).toBe(
      'Search indexer and Order API have to move to v2 by M4, when v1 is removed; any that has not stops receiving `product.changed`.',
    );
    expect(s?.sequence).toBeNull();
    expect(s?.early).toBe(false);
    expect(s?.kind).toBe('retire');
    expect(msShort(model, 'ms:m4')).toBeTypeOf('string');
  });

  it('badges both ends of a pair', () => {
    const model = modelOf(load());
    expect(versionPair(model, 'msg:product-changed')).toEqual({
      side: 'old',
      lead: 'Removed v1',
      other: '→ v2',
    });
    expect(versionPair(model, 'msg:product-changed-v2')).toEqual({
      side: 'new',
      lead: 'New v2',
      other: 'replaces v1',
    });
    expect(versionPair(model, 'sch:search-doc')).toBeNull();
  });

  it('says nothing of an unversioned id', () => {
    const model = modelOf(load());
    expect(ladderView(model, 'sch:search-doc')).toBeNull();
    expect(ladderSummary(model, 'sch:search-doc')).toBeNull();
  });
});

describe('ladder rungs', () => {
  it('walks expand, migrate, remove with the work each rung builds once', () => {
    const model = modelOf(load());
    const view = ladderView(model, 'msg:product-changed');
    expect(view?.rungs.map((r) => r.kind)).toEqual([
      'expand',
      'migrate',
      'migrate',
      'deprecate',
      'retire',
    ]);
    expect(view?.rungs[0]?.what.map((s) => s.text).join('')).toBe(
      'Products API starts publishing v2 next to v1',
    );
    expect(view?.rungs[1]?.what[0]).toMatchObject({ tone: 'who', id: 'svc:search-indexer' });
    expect(view?.rungs[1]?.note).toContain('stops reading the old one');
    const items = view?.rungs.flatMap((r) => r.items.map((i) => i.id)) ?? [];
    expect(items).toEqual(['wi:publish-v2', 'wi:indexer-v2', 'wi:orders-v2', 'wi:retire-v1']);
    expect(view?.legend).toHaveLength(4);
    expect(view?.keepsOld).toBe(false);
  });

  it('draws a graph field moving between subgraphs by the model label', () => {
    const model = modelOf(shop());
    const id = ladderIds(model).find((x) => x.includes('#'));
    expect(id).toBe('sch:gql-product#price');
    const view = ladderView(model, id ?? '');
    expect(view?.rungs.length).toBeGreaterThan(1);
    expect(ladderSummary(model, id ?? '')?.deadline).toBe('');
  });
});

describe('sequencing', () => {
  it('is quiet when the plan is in order', () => {
    const model = modelOf(load());
    expect(sequencing(model, 'msg:product-changed')).toBeNull();
    expect(sequencing(model, 'sch:search-doc')).toBeNull();
    expect(sequenceNotes(model).size).toBe(0);
  });

  it('names a consumer that switches before the new version exists', () => {
    const plan = structuredClone(load());
    const last = plan.milestones?.at(-1)?.id;
    const expand = plan.work_items?.find((w) => w.id === 'wi:publish-v2');
    if (expand !== undefined && last !== undefined) expand.milestone = last;
    const model = modelOf(plan);
    const seq = sequencing(model, 'msg:product-changed');
    expect(seq?.sentences).toEqual([
      'Search indexer and Order API are planned to switch to v2 in M2, a milestone before v2 exists.',
    ]);
    expect(seq?.notes.map((n) => n.wi)).toEqual(['wi:indexer-v2', 'wi:orders-v2', 'wi:publish-v2']);
    expect(sequenceNotes(model).size).toBeGreaterThan(0);
    expect(ladderSummary(model, 'msg:product-changed')?.sequence).not.toBeNull();
  });

  it('flags removing the old version before the last consumer moves', () => {
    const plan = structuredClone(load());
    const first = plan.milestones?.[0]?.id;
    const summary = modelOf(plan);
    const retire = summary.ladder('msg:product-changed').rungs.find((r) => r.kind === 'retire');
    for (const w of plan.work_items ?? []) {
      if (retire?.workItems.includes(w.id) === true && first !== undefined) w.milestone = first;
    }
    const model = modelOf(plan);
    expect(ladderSummary(model, 'msg:product-changed')?.early).toBe(true);
    expect(ladderSummary(model, 'msg:product-changed')?.retire).toContain('check the plan');
    expect(sequencing(model, 'msg:product-changed')?.sentences.join(' ')).toContain('before');
  });
});

describe('event data', () => {
  it('reads an event in each mode', () => {
    const model = modelOf(load());
    const diff = eventData(model, 'msg:product-changed', 'diff');
    expect(diff).toMatchObject({
      name: 'product.changed',
      version: 'v1',
      producer: 'svc:products',
    });
    expect(diff?.replacedBy).toBe('msg:product-changed-v2');
    expect(diff?.migration).toContain('goes to v2');
    expect(
      eventData(model, 'msg:product-changed', 'asIs')?.published.points.map((p) => p.by),
    ).toEqual(['svc:products']);
    const was = eventData(model, 'msg:product-changed', 'asIs');
    expect(was?.replacedBy).toBeNull();
    expect(was?.migration).toBeNull();
    expect(was?.status).toBeNull();
    expect(eventData(model, 'msg:product-changed-v2', 'asIs')?.now).toEqual([]);
    expect(eventData(model, 'sch:search-doc', 'diff')).toBeNull();
  });

  it('sorts by topic, name and version', () => {
    const model = modelOf(load());
    const ids = model.toBe.messages.map((m) => m.id);
    const sorted = sortEvents(model, ids.toReversed());
    expect(sorted).toEqual(['msg:order-placed', 'msg:product-changed-v2']);
    expect(sortEvents(model, sorted)).toEqual(sorted);
  });
});
