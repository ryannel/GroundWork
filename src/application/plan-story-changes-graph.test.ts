// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
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

vi.mock('server-only', () => ({}));

async function load(plan: string) {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', plan);
  if (loaded.plan === null) throw new Error(`no plan ${plan}`);
  return derive(loaded.plan);
}

const model = await load('storefront-graph');
const change = graphChangeOf(model);
if (change === null) throw new Error('storefront-graph changes no graph');
const { diff } = change;

describe('graph change', () => {
  it('exists only for the plan that changes a graph', async () => {
    expect(change.graphId).toBe('graph:storefront');
    for (const plan of ['delivery-promise', 'invoice-vat-number', 'stock-reservation']) {
      expect(graphChangeOf(await load(plan)), plan).toBeNull();
      expect(graphChange(await load(plan)), plan).toBeNull();
    }
  });

  it('says what the reader feels, in one sentence ending in a full stop', () => {
    const shaped = graphChange(model);
    expect(shaped?.headline).toMatch(/\.$/u);
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
    for (const row of rows.filter((r) => r.kind === 'new')) {
      const from = splitOf(model, diff, row);
      if (from !== null) expect(splitWhy(model, row, from)).not.toBe('');
    }
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
    if (moved?.before === null || moved?.after === null || moved === undefined)
      throw new Error('no changed operation');
    expect(routeSummary(moved.before, moved.after)).not.toBe('');
  });
});
