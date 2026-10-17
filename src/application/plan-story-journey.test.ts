// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { giftWrap } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { shopGraph } from '@/../test/fixtures/journeys-shop-graph';
import { modelOf } from '@/../test/plan-kit';
import { journeyScreens } from '@/application/plan-pages-screens-journey';
import { behindStory } from '@/application/plan-story-journey-behind';
import { behindHeadline } from '@/application/plan-story-journey-behind-words';
import { executionStory } from '@/application/plan-story-journey-execution';
import { flowView } from '@/application/plan-story-journey-flow';
import { journeyGroups } from '@/application/plan-story-journey-groups';
import { behindOperations } from '@/application/plan-story-journey-order';
import { expiryOf, purgesOf } from '@/application/plan-story-journey-purges';
import { waterfallFacts } from '@/application/plan-viz-waterfall-facts';
import type { Plan } from '@/domain/plan/plan.generated';

const PLANS: Readonly<Record<string, () => Plan>> = {
  'gift-wrap': giftWrap,
  'pause-orders': pauseOrders,
  'order-event-v2': orderEventV2,
  shop: shopGraph,
};

function load(plan: string) {
  const make = PLANS[plan];
  if (make === undefined) throw new Error(`no plan ${plan}`);
  return modelOf(make());
}

/** The shop graph with the story of how it plays out, citing its flows. */
function shopWithExecution() {
  const plan = shopGraph();
  plan.execution = {
    summary: 'The product page asks the graph once. Prices move through the purger.',
    paths: [
      {
        name: 'A shopper looks',
        steps: [
          { label: 'Open', detail: 'The page asks for the product ([[flow:browse]]).' },
          { label: 'Add', detail: 'The shopper adds it ([[flow:add#add]]).' },
        ],
      },
      {
        name: 'A price moves',
        steps: [
          { label: 'Publish', detail: 'Pricing publishes ([[flow:price-purge]]).' },
          { label: 'Wait', detail: 'The edge refills on the next request.' },
        ],
      },
    ],
  };
  return modelOf(plan);
}

describe('journey groups', () => {
  it('gives a page to each scenario with flows, then to each flow no scenario covers', () => {
    const model = load('gift-wrap');
    const groups = journeyGroups(model);
    const scenarios = groups.filter((g) => g.scenario !== null);
    expect(scenarios.map((g) => g.key)).toEqual(['sc-birthday-gift', 'sc-no-wrap']);
    expect(scenarios[0]?.title).toMatch(/^Planned scenario: A birthday/u);
    expect(scenarios[0]?.flows).toEqual(['flow:place-order', 'flow:wrap-order']);
    const loose = groups.filter((g) => g.scenario === null);
    expect(loose.map((g) => g.key)).toEqual(['flow-publish-product']);
    expect(loose.every((g) => g.flows.length === 1)).toBe(true);
  });

  it.each(Object.keys(PLANS))('%s: the chapter lists a screen for each group', (plan) => {
    const model = load(plan);
    const keys = journeyScreens(model).map((s) => s.key);
    for (const group of journeyGroups(model)) expect(keys).toContain(group.key);
    expect(keys.includes('behind')).toBe(behindOperations(model).length > 0);
  });
});

describe('flow view', () => {
  it('says what the plan does to a flow', () => {
    const model = load('gift-wrap');
    expect(flowView(model, 'flow:place-order').claim).toBe(
      'Place an order: two steps change, one step is added.',
    );
    const added = flowView(model, 'flow:wrap-order');
    expect(added.claim).toMatch(/: new with this plan, two steps\.$/u);
    expect(added.option).toMatch(/ · New$/u);
  });

  it('calls a flow more than one scenario walks shared', () => {
    const model = load('gift-wrap');
    expect(flowView(model, 'flow:place-order').lines[0]?.label).toBe(
      'Recorded trigger for this shared flow',
    );
    expect(flowView(model, 'flow:wrap-order').lines[0]?.label).toBe('Starts when');
  });

  it('says so when nothing changes', () => {
    const model = load('gift-wrap');
    expect(flowView(model, 'flow:publish-product').claim).toBe(
      'Publish a product: nothing changes.',
    );
  });
});

describe('execution', () => {
  it('leads with the first sentence of the summary and links a cited flow to its page', () => {
    const model = load('gift-wrap');
    const story = executionStory(model);
    expect(story?.headline).toBe(
      'Wrapping is chosen once on the basket and paid for with the order.',
    );
    const pages = new Set(journeyGroups(model).map((g) => g.key));
    expect(story?.paths.flatMap((p) => p.steps.map((s) => s.page))).toEqual([
      'sc-birthday-gift',
      'sc-birthday-gift',
      null,
      null,
      'flow-publish-product',
      null,
    ]);
    const linked = story?.paths.flatMap((p) => p.steps).filter((s) => s.page !== null) ?? [];
    expect(linked).toHaveLength(3);
    for (const step of linked) expect(pages.has(step.page ?? '')).toBe(true);
  });
});

describe('behind the button', () => {
  it('has nothing to say for a plan with no operations', () => {
    expect(behindStory(load('gift-wrap'))).toEqual([]);
  });

  it('costs each operation in time, round trips and teams, and names whom to call', () => {
    const stories = behindStory(load('shop'));
    const page = stories.find((s) => s.id === 'gql:product-page');
    expect(page?.headline).toBe(
      'Showing the hero on the product page takes 15 ms when the edge cache has it and about 120 ms when nothing does.',
    );
    expect(page?.when).toBe('when the page loads');
    expect(page?.gateway).toEqual({ team: 'team:web', decides: true });
    expect(page?.teams).toEqual(['team:catalog', 'team:pricing', 'team:fulfil']);
    expect(page?.purges.rows.length).toBeGreaterThan(0);
    expect(page?.purges.flow).toBe('flow:price-purge');
    expect(page?.change).toBe('3 → 4 fetches, 2 → 3 round trips');
    expect(stories.find((s) => s.id === 'gql:cart-summary')?.change).toBe('a subgraph is swapped');
    const cart = stories.find((s) => s.id === 'gql:add-to-cart');
    expect(cart?.headline).toBe(
      'Add to cart is never cached: it takes one round trip across one team, every time.',
    );
    expect(cart?.cache?.text).toBe('A mutation is never cached.');
  });

  it('keeps an override’s note only when it says something', () => {
    const stories = behindStory(load('shop'));
    expect(stories.find((s) => s.id === 'gql:search-reviews')?.cache?.note).toBeNull();
    expect(stories.find((s) => s.id === 'gql:product-page')?.cache?.note).toBe(
      'The plan keeps it for 600 s instead of the 30 s the rules give: stock is shown as in/out only',
    );
  });

  it('puts operations in the order of the screens that send them', () => {
    const model = load('shop');
    const ids = behindOperations(model).map((o) => o.id);
    expect(ids.indexOf('gql:product-page')).toBeLessThan(ids.indexOf('gql:search-reviews'));
    expect(ids.at(-1)).toBe('gql:search-reviews');
  });
});

describe('purges', () => {
  it('says how long a layer keeps what no event purges', () => {
    expect(expiryOf('blocked', 60)).toBe('keeps nothing of this operation');
    expect(expiryOf('ready', null)).toBe('expires on a timer');
    expect(expiryOf('ready', 0)).toBe('expires on a timer');
    expect(expiryOf('ready', 60)).toBe('expires after 60 s');
  });

  it('names the events that purge each layer and the way they do it', () => {
    const model = load('shop');
    const [edge, entity] = purgesOf(model, 'gql:product-page').rows;
    expect(edge?.store).toBe('st:edge-cache');
    expect(edge?.events).toContain('msg:price-published');
    expect(edge?.expires).toBeNull();
    expect(edge?.mechanism).toBe('surrogate key per sku, sent by the purger');
    expect(entity?.expires).toBe('expires on a timer');
  });
});

describe('execution of every plan', () => {
  it.each([
    ['gift-wrap', () => load('gift-wrap')],
    ['shop', shopWithExecution],
  ])('%s: a step links to a page of the journey chapter or to none', (_, make) => {
    const model = make();
    const pages = new Set(journeyScreens(model).map((s) => s.key));
    const steps = executionStory(model)?.paths.flatMap((p) => p.steps) ?? [];
    expect(steps.length).toBeGreaterThan(1);
    for (const step of steps) expect(step.page === null || pages.has(step.page)).toBe(true);
  });
});

function bare() {
  const plan = shopGraph();
  for (const op of plan.operations ?? []) {
    delete op.screens;
    delete op.trigger;
    delete op.summary;
    for (const use of op.cache ?? []) delete use.reason;
  }
  return modelOf(plan);
}

describe('an operation the plan says little about', () => {
  it('is placed on the page, sent by the front end, and costed from its fields alone', () => {
    const stories = behindStory(bare());
    const page = stories.find((s) => s.id === 'gql:product-page');
    expect(page?.screen).toBeNull();
    expect(page?.when).toBe('by the front end');
    expect(page?.headline).toMatch(/^Showing the page takes/u);
    expect(page?.lede).toMatch(/^\d+ fields? · /u);
    expect(page?.cache?.note).toMatch(/s the rules give: $/u);
  });
});

function facts() {
  const model = load('shop');
  const op = (model.plan.operations ?? []).find((o) => o.id === 'gql:product-page');
  if (op === undefined) throw new Error('no operation');
  return { model, op, base: waterfallFacts(model, op.id, 'asIs') };
}

describe('what a place on a screen costs', () => {
  it('gives the measured time of a hit and a miss, of a miss alone, or the round trips', () => {
    const { model, op, base } = facts();
    const both = { ...base, layerObserved: true, layerHit: 20, layerCold: 300, hitLayer: null };
    expect(behindHeadline(model, op, both)).toMatch(/takes 20 ms when the .+ cache has it/u);
    const cold = { ...base, layerObserved: true, layerHit: null, layerCold: 300 };
    expect(behindHeadline(model, op, cold)).toMatch(/about 300 ms, across /u);
    const unmeasured = { ...base, layerObserved: false };
    expect(behindHeadline(model, op, unmeasured)).toMatch(/round trips? across /u);
  });

  it('says a private response is never kept at the edge, and a mutation never cached', () => {
    const { model, op, base } = facts();
    if (base.policy === null) throw new Error('no policy');
    const priv = {
      ...base,
      layerObserved: false,
      policy: { ...base.policy, scope: 'private' as const },
    };
    expect(behindHeadline(model, op, priv)).toMatch(
      /It is private, so the edge never keeps it\.$/u,
    );
    const mutation = (model.plan.operations ?? []).find((o) => o.kind === 'mutation');
    if (mutation === undefined) throw new Error('no mutation');
    const plan = waterfallFacts(model, mutation.id, 'asIs');
    expect(behindHeadline(model, mutation, plan)).toMatch(/is never cached: it takes /u);
    expect(behindHeadline(model, op, { ...base, plan: null })).toMatch(/has no query plan\.$/u);
  });
});
