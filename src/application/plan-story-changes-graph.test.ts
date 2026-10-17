// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { graphChange, graphChangeOf } from '@/application/plan-story-changes-graph';
import {
  edgeWord,
  graphClaim,
  opImpact,
  opsPhrase,
  routeSummary,
  secsText,
  splitOf,
  splitWhy,
} from '@/application/plan-story-changes-graph-ops';

const model = modelOf(shop());
const change = graphChangeOf(model);
if (change === null) throw new Error('the shop plan changes no graph');
const { diff } = change;

describe('graph change', () => {
  it('exists only for the plan that changes a graph', () => {
    expect(change.graphId).toBe('graph:shop');
    for (const plan of [pauseOrders(), dispatchDate()]) {
      expect(graphChangeOf(modelOf(plan)), plan.meta.id).toBeNull();
      expect(graphChange(modelOf(plan)), plan.meta.id).toBeNull();
    }
  });

  it('says what the reader feels, in one sentence ending in a full stop', () => {
    const shaped = graphChange(model);
    expect(shaped?.headline).toBe(
      'Estimated round trips: ProductPage goes from 2 to 3 round trips.',
    );
    expect(shaped?.changeIds.length).toBeGreaterThan(0);
  });
});

describe('operation impact', () => {
  const rows = opImpact(model, diff);

  it('has a row for every operation the plan changes, worst first', () => {
    expect(rows).toHaveLength(diff.operations.length);
    const rank = ['lost', 'up', 'new', 'down', 'same'];
    const ranks = rows.map((r) => rank.indexOf(r.kind));
    expect(ranks).toEqual(ranks.toSorted((a, b) => a - b));
  });

  it('claims the new and slower operations in the graph claim', () => {
    const claim = graphClaim(model, diff, rows);
    expect(claim).not.toBe('');
    for (const row of rows.filter((r) => r.kind === 'up')) expect(claim).toContain(row.name);
    expect(graphClaim(model, diff)).toBe(claim);
  });

  it('says where a new operation was split from, and why', () => {
    const split = rows
      .filter((r) => r.kind === 'new')
      .flatMap((row) => {
        const from = splitOf(model, diff, row);
        return from === null ? [] : [{ row, from }];
      });
    for (const { row, from } of split) expect(splitWhy(model, row, from)).not.toBe('');
  });

  it('words the edge for each side of every operation', () => {
    for (const row of rows) {
      expect(edgeWord(model, row.id, { mode: 'toBe', summary: row.after })).not.toBe('');
      expect(edgeWord(model, row.id, { mode: 'asIs', summary: row.before })).not.toBe('');
    }
  });
});

describe('words', () => {
  it('counts seconds and whole minutes', () => {
    expect(secsText(30)).toBe('30 s');
    expect(secsText(120)).toBe('2 min');
    expect(secsText(90)).toBe('90 s');
  });

  it('counts the operations that change and how many take a different route', () => {
    expect(opsPhrase(0, 0)).toBe('');
    expect(opsPhrase(1, 0)).toBe('One operation changes, on the same route');
    expect(opsPhrase(2, 2)).toBe('Two operations take a different route');
    expect(opsPhrase(3, 2)).toBe('Three operations change, two on a different route');
  });

  it('summarises a route that changes', () => {
    const moved = diff.operations.find((o) => o.before !== null && o.after !== null);
    if (moved?.before === null || moved?.after === null || moved === undefined) {
      throw new Error('no changed operation');
    }
    expect(routeSummary(moved.before, moved.after)).not.toBe('');
  });
});
