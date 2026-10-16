// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { domainHead } from '@/application/plan-story-today-domain';
import { graphStory } from '@/application/plan-story-today-graph';
import { systemStops } from '@/application/plan-story-today-system';

vi.mock('server-only', () => ({}));

async function load(plan: string) {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', plan);
  if (loaded.plan === null) throw new Error(`no plan ${plan}`);
  return derive(loaded.plan);
}

const PLANS = ['delivery-promise', 'invoice-vat-number', 'stock-reservation', 'storefront-graph'];

describe('system stops', () => {
  it.each(PLANS)('%s: four stops, each saying what is true', async (plan) => {
    const model = await load(plan);
    const stops = systemStops(model);
    expect(stops.map((s) => s.focus)).toEqual(['all', 'api', 'msg', 'data']);
    for (const stop of stops) {
      expect(stop.headline).toMatch(/\S/u);
      expect(stop.headline).not.toMatch(/undefined|\[object/u);
    }
  });
});

describe('domain head', () => {
  it.each(PLANS)('%s: says where the words are created', async (plan) => {
    const model = await load(plan);
    const head = domainHead(model);
    expect(head.headline).not.toMatch(/undefined|\[object/u);
  });
});

describe('graph story', () => {
  it('has three stops for a plan with a graph', async () => {
    const story = graphStory(await load('storefront-graph'));
    expect(story?.stops.map((s) => s.key)).toEqual(['picture', 'grid', 'caches']);
  });

  it('is absent when there is no graph', async () => {
    expect(graphStory(await load('delivery-promise'))).toBeNull();
  });

  it('says so when nothing is cached on the way', async () => {
    const model = await load('storefront-graph');
    const bare = { ...model, asIs: { ...model.asIs, stores: [] } };
    expect(graphStory(bare)?.stops[2]?.headline).toMatch(/^Nothing is cached/u);
  });

  it('counts the subgraphs when the graph has no types', async () => {
    const model = await load('storefront-graph');
    const [graph] = model.asIs.graphs;
    if (graph === undefined) throw new Error('no graph');
    const empty = { ...model, asIs: { ...model.asIs, graphs: [{ ...graph, id: 'graph:none' }] } };
    expect(graphStory(empty)?.stops[1]?.headline).toMatch(/divide the graph’s fields/u);
  });
});

describe('what each stop claims', () => {
  it('names the team that runs the most, or says none does', async () => {
    expect(systemStops(await load('stock-reservation'))[0]?.headline).toBe(
      'Fulfilment runs the most of it: three of the six components; two other teams run the rest.',
    );
    expect(systemStops(await load('delivery-promise'))[0]?.headline).toMatch(/^No one team/u);
  });

  it('finds the hub topic and the most shared store', async () => {
    const stops = systemStops(await load('delivery-promise'));
    expect(stops[2]?.headline).toBe(
      'catalog.events is the hub: PIM API publishes, four components listen.',
    );
    expect(stops[3]?.headline).toMatch(/^wms-db is shared: three components/u);
  });

  it('says a graph picks the busiest type', async () => {
    const story = graphStory(await load('storefront-graph'));
    expect(story?.stops[1]?.headline).toMatch(/^Product is the busiest type/u);
  });

  it('lists the words a plan adds for the journeys', async () => {
    const head = domainHead(await load('delivery-promise'));
    expect(head.addedBefore).toBe('This plan adds three words: ');
    expect(head.addedAfter).toBe('; you meet them in Journey.');
  });
});
