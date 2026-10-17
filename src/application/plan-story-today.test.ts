// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { giftWrap } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { shopGraph } from '@/../test/fixtures/journeys-shop-graph';
import { modelOf } from '@/../test/plan-kit';
import { derive } from '@/application/plan/derive';
import { domainHead } from '@/application/plan-story-today-domain';
import { graphStory } from '@/application/plan-story-today-graph';
import { systemStops } from '@/application/plan-story-today-system';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const mini = await loadFixture('mini.yaml');

const PLANS: Readonly<Record<string, () => Plan>> = {
  'gift-wrap': giftWrap,
  'pause-orders': pauseOrders,
  'order-event-v2': orderEventV2,
  shop: shopGraph,
  mini: () => structuredClone(mini),
};

function load(plan: string) {
  const make = PLANS[plan];
  if (make === undefined) throw new Error(`no plan ${plan}`);
  return plan === 'mini' ? derive(make()) : modelOf(make());
}

describe('system stops', () => {
  it.each(Object.keys(PLANS))('%s: four stops, each saying what is true', (plan) => {
    const model = load(plan);
    const stops = systemStops(model);
    expect(stops.map((s) => s.focus)).toEqual(['all', 'api', 'msg', 'data']);
    for (const stop of stops) {
      expect(stop.headline).toMatch(/\S/u);
      expect(stop.headline).not.toMatch(/undefined|\[object/u);
    }
  });
});

describe('domain head', () => {
  it.each(Object.keys(PLANS))('%s: says where the words are created', (plan) => {
    const model = load(plan);
    const head = domainHead(model);
    expect(head.headline).not.toMatch(/undefined|\[object/u);
  });
});

describe('graph story', () => {
  it('has three stops for a plan with a graph', () => {
    const story = graphStory(load('shop'));
    expect(story?.stops.map((s) => s.key)).toEqual(['picture', 'grid', 'caches']);
  });

  it('is absent when there is no graph', () => {
    expect(graphStory(load('gift-wrap'))).toBeNull();
  });

  it('says so when nothing is cached on the way', () => {
    const model = load('shop');
    const bare = { ...model, asIs: { ...model.asIs, stores: [] } };
    expect(graphStory(bare)?.stops[2]?.headline).toMatch(/^Nothing is cached/u);
  });

  it('counts the subgraphs when the graph has no types', () => {
    const model = load('shop');
    const [graph] = model.asIs.graphs;
    if (graph === undefined) throw new Error('no graph');
    const empty = { ...model, asIs: { ...model.asIs, graphs: [{ ...graph, id: 'graph:none' }] } };
    expect(graphStory(empty)?.stops[1]?.headline).toMatch(/divide the graph’s fields/u);
  });
});

describe('what each stop claims', () => {
  it('names the team that runs the most, or says none does', () => {
    expect(systemStops(load('pause-orders'))[0]?.headline).toBe(
      'Orders runs the most of it: three of the seven components; two other teams run the rest.',
    );
    expect(systemStops(load('mini'))[0]?.headline).toMatch(/^No one team/u);
  });

  it('finds the hub topic and the most shared store', () => {
    const stops = systemStops(load('mini'));
    expect(stops[2]?.headline).toBe(
      'subscription.events is the hub: Subscriptions publishes, two components listen.',
    );
    expect(stops[3]?.headline).toMatch(/^billing-db is shared: two components/u);
  });

  it('says a graph picks the busiest type', () => {
    const story = graphStory(load('shop'));
    expect(story?.stops[1]?.headline).toMatch(/^Product is the busiest type/u);
  });

  it('lists the words a plan adds for the journeys', () => {
    const head = domainHead(load('gift-wrap'));
    expect(head.addedBefore).toBe('This plan adds two words: ');
    expect(head.addedAfter).toBe('; you meet them in Journey.');
    expect(head.added.map((a) => a.id)).toEqual(['con:gift-wrap', 'con:gift-note']);
  });
});
