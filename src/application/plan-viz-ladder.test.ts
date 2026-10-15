// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
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

vi.mock('server-only', () => ({}));

async function load() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'delivery-promise');
  return loaded.plan!;
}

describe('ladder words', () => {
  it('lists names the way a sentence does', () => {
    expect(andList([])).toBe('');
    expect(andList(['a'])).toBe('a');
    expect(andList(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('summarises a versioned event', async () => {
    const model = derive(await load());
    expect(ladderIds(model)).toContain('msg:product-published');
    const s = ladderSummary(model, 'msg:product-published');
    expect(s?.headline).toBe('`product.published` goes to v2; four consumers migrate');
    expect(s?.retire).toBe('v1 is removed in M4, once every consumer has moved.');
    expect(s?.deadline).toContain('have to move to v2 by M4');
    expect(s?.kind).toBe('retire');
    expect(msShort(model, 'ms:m4')).toBeTypeOf('string');
  });

  it('badges both ends of a pair', async () => {
    const model = derive(await load());
    expect(versionPair(model, 'msg:product-published')).toMatchObject({
      side: 'old',
      other: '→ v2',
    });
    expect(versionPair(model, 'msg:product-published-v2')).toEqual({
      side: 'new',
      lead: 'New v2',
      other: 'replaces v1',
    });
    expect(versionPair(model, 'sch:shipment')).toBeNull();
  });

  it('says nothing of an unversioned id', async () => {
    const model = derive(await load());
    expect(ladderView(model, 'sch:shipment')).toBeNull();
    expect(ladderSummary(model, 'sch:shipment')).toBeNull();
  });
});

describe('ladder rungs', () => {
  it('walks expand, migrate, remove with the work each rung builds once', async () => {
    const model = derive(await load());
    const view = ladderView(model, 'msg:product-published');
    expect(view?.rungs.map((r) => r.kind)).toEqual([
      'expand',
      'migrate',
      'migrate',
      'migrate',
      'migrate',
      'deprecate',
      'retire',
    ]);
    expect(view?.rungs[0]?.what.map((s) => s.text).join('')).toBe(
      'PIM API starts publishing v2 next to v1',
    );
    expect(view?.rungs[1]?.what[0]).toMatchObject({ tone: 'who', id: 'svc:catalog-api' });
    expect(view?.rungs[1]?.note).toContain('stops reading the old one');
    const items = view?.rungs.flatMap((r) => r.items.map((i) => i.id)) ?? [];
    expect(new Set(items).size).toBe(items.length);
    expect(view?.legend).toHaveLength(4);
    expect(view?.keepsOld).toBe(false);
  });

  it('draws a graph field moving between subgraphs by the model label', async () => {
    const { readPlan } = await import('@/infrastructure/plan-store');
    const loaded = await readPlan('alder-finch', 'storefront-graph');
    const model = derive(loaded.plan!);
    const id = ladderIds(model).find((x) => x.includes('#'));
    expect(id).toBeDefined();
    const view = ladderView(model, id ?? '');
    expect(view?.rungs.length).toBeGreaterThan(1);
    expect(ladderSummary(model, id ?? '')?.deadline).toBe('');
  });
});

describe('sequencing', () => {
  it('is quiet when the plan is in order', async () => {
    const model = derive(await load());
    expect(sequencing(model, 'msg:product-published')).toBeNull();
    expect(sequencing(model, 'sch:shipment')).toBeNull();
    expect(sequenceNotes(model).size).toBe(0);
  });

  it('names a consumer that switches before the new version exists', async () => {
    const plan = structuredClone(await load());
    const last = plan.milestones?.at(-1)?.id;
    const expand = plan.work_items?.find((w) => w.id === 'wi:pim-promise');
    if (expand !== undefined && last !== undefined) expand.milestone = last;
    const model = derive(plan);
    const seq = sequencing(model, 'msg:product-published');
    expect(seq?.sentences[0]).toContain('planned to switch to v2');
    expect(seq?.notes.length).toBeGreaterThan(1);
    expect(sequenceNotes(model).size).toBeGreaterThan(0);
    expect(ladderSummary(model, 'msg:product-published')?.sequence).not.toBeNull();
  });

  it('flags removing the old version before the last consumer moves', async () => {
    const plan = structuredClone(await load());
    const first = plan.milestones?.[0]?.id;
    const summary = derive(plan);
    const retire = summary.ladder('msg:product-published').rungs.find((r) => r.kind === 'retire');
    for (const w of plan.work_items ?? []) {
      if (retire?.workItems.includes(w.id) === true && first !== undefined) w.milestone = first;
    }
    const model = derive(plan);
    expect(ladderSummary(model, 'msg:product-published')?.early).toBe(true);
    expect(ladderSummary(model, 'msg:product-published')?.retire).toContain('check the plan');
    expect(sequencing(model, 'msg:product-published')?.sentences.join(' ')).toContain('before');
  });
});

describe('event data', () => {
  it('reads an event in each mode', async () => {
    const model = derive(await load());
    const diff = eventData(model, 'msg:product-published', 'diff');
    expect(diff).toMatchObject({ name: 'product.published', version: 'v1', producer: 'svc:pim' });
    expect(diff?.replacedBy).toBe('msg:product-published-v2');
    expect(diff?.migration).toContain('goes to v2');
    expect(
      eventData(model, 'msg:product-published', 'asIs')?.published.points.length,
    ).toBeGreaterThan(0);
    const was = eventData(model, 'msg:product-published', 'asIs');
    expect(was?.replacedBy).toBeNull();
    expect(was?.migration).toBeNull();
    expect(was?.status).toBeNull();
    expect(eventData(model, 'msg:product-published-v2', 'asIs')?.now).toEqual([]);
    expect(eventData(model, 'sch:shipment', 'diff')).toBeNull();
  });

  it('sorts by topic, name and version', async () => {
    const model = derive(await load());
    const ids = model.toBe.messages.map((m) => m.id);
    const sorted = sortEvents(model, ids.toReversed());
    expect(sorted).toHaveLength(ids.length);
    expect(sortEvents(model, sorted)).toEqual(sorted);
  });
});
