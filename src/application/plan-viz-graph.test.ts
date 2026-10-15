// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { fieldName, graphTypes, subgraphLabel } from '@/application/plan-viz-graph-base';
import { cacheTable } from '@/application/plan-viz-graph-caches';
import { ownershipGrid } from '@/application/plan-viz-graph-grid';
import { graphPicture } from '@/application/plan-viz-graph-picture';

vi.mock('server-only', () => ({}));

async function load(plan: string) {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', plan);
  if (loaded.plan === null) throw new Error(`no plan ${plan}`);
  return derive(loaded.plan);
}

const model = await load('storefront-graph');
const graph = 'graph:storefront';

describe('graph picture', () => {
  it('reads left to right: clients, edge, gateway, gateway cache, subgraphs', () => {
    const view = graphPicture(model, graph);
    expect(view?.edge.map((b) => b.id)).toContain('st:edge-cache');
    expect(view?.gatewayCache.map((b) => b.id)).toContain('st:gateway-entity-cache');
    expect(view?.gateway.operations.length).toBe(5);
    expect(view?.rows.length).toBe(model.asIs.subgraphs.length);
    for (const row of view?.rows ?? []) expect(row.label).not.toMatch(/ subgraph$/u);
  });

  it('is nothing for a graph it does not know', () => {
    expect(graphPicture(model, 'graph:none')).toBeNull();
  });

  it('shows the plan side when asked', () => {
    const rows = graphPicture(model, graph, 'toBe')?.rows.map((r) => r.id) ?? [];
    expect(rows).toContain('sg:promise');
    expect(rows).toContain('sg:pricing-v2');
  });
});

describe('ownership grid', () => {
  it('has a column per subgraph and a row per type, roots last', () => {
    const grid = ownershipGrid(model, graph, {});
    expect(grid?.columns.length).toBe(model.asIs.subgraphs.length);
    const roots = grid?.rows.map((r) => r.root) ?? [];
    expect(roots).toContain(true);
    expect(roots.lastIndexOf(false)).toBeLessThan(roots.indexOf(true));
    expect(
      grid?.rows.flatMap((r) => r.cells).every((c) => c.fields.every((f) => f.state === 'same')),
    ).toBe(true);
  });

  it('marks what the plan adds and retires when given the diff', () => {
    const grid = ownershipGrid(model, graph, { diff: model.graphDiff(graph) });
    const status = (id: string) => grid?.columns.find((c) => c.id === id)?.status;
    expect(status('sg:pricing')).toBe('deprecated');
    expect(status('sg:promise')).toBe('added');
    const states = new Set(
      grid?.rows.flatMap((r) => r.cells.flatMap((c) => c.fields.map((f) => f.state))),
    );
    expect(states.has('new')).toBe(true);
  });

  it('is nothing for a graph it does not know', () => {
    expect(ownershipGrid(model, 'graph:none', {})).toBeNull();
  });
});

describe('cache table', () => {
  it('lists the caches outermost first', () => {
    const rows = cacheTable(model, {});
    expect(rows.map((r) => r.layer)).toEqual(
      rows.map((r) => r.layer).toSorted((a, b) => a.localeCompare(b)),
    );
    expect(rows[0]?.layer).toBe('edge');
    expect(rows.every((r) => r.status === 'same')).toBe(true);
  });

  it('marks what changes when given the diff', () => {
    const rows = cacheTable(model, { diff: model.graphDiff(graph) });
    expect(rows.some((r) => r.status !== 'same')).toBe(true);
  });
});

describe('base helpers', () => {
  it('trims the subgraph word and spots private fields', () => {
    expect(subgraphLabel(model, 'sg:pricing')).not.toMatch(/ subgraph$/iu);
    const fields =
      ownershipGrid(model, graph, {})?.rows.flatMap((r) => r.cells.flatMap((c) => c.fields)) ?? [];
    expect(fields.some((f) => f.private)).toBe(true);
    expect(fields.some((f) => !f.private)).toBe(true);
    expect(fieldName('type:Order#total')).toBe('total');
    expect(graphTypes(model, graph).length).toBeGreaterThan(0);
  });
});
