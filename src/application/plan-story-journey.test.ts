// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { journeyScreens } from '@/application/plan-pages-screens-journey';
import { behindStory } from '@/application/plan-story-journey-behind';
import { behindHeadline } from '@/application/plan-story-journey-behind-words';
import { executionStory } from '@/application/plan-story-journey-execution';
import { flowView } from '@/application/plan-story-journey-flow';
import { journeyGroups } from '@/application/plan-story-journey-groups';
import { behindOperations } from '@/application/plan-story-journey-order';
import { expiryOf, purgesOf } from '@/application/plan-story-journey-purges';
import { waterfallFacts } from '@/application/plan-viz-waterfall-facts';

vi.mock('server-only', () => ({}));

async function load(plan: string) {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', plan);
  if (loaded.plan === null) throw new Error(`no plan ${plan}`);
  return derive(loaded.plan);
}

const PLANS = ['delivery-promise', 'invoice-vat-number', 'stock-reservation', 'storefront-graph'];

describe('journey groups', () => {
  it('gives a page to each scenario with flows, then to each flow no scenario covers', async () => {
    const model = await load('delivery-promise');
    const groups = journeyGroups(model);
    const scenarios = groups.filter((g) => g.scenario !== null);
    expect(scenarios.map((g) => g.key)).toEqual([
      'sc-anna-malmo',
      'sc-tomas-paylater',
      'sc-category-manager',
      'sc-berlin-slip',
    ]);
    expect(scenarios[0]?.title).toMatch(/^Planned scenario: Anna/u);
    const loose = groups.filter((g) => g.scenario === null);
    expect(loose.every((g) => g.flows.length === 1)).toBe(true);
  });

  it.each(PLANS)('%s: the chapter lists a screen for each group', async (plan) => {
    const model = await load(plan);
    const keys = journeyScreens(model).map((s) => s.key);
    for (const group of journeyGroups(model)) expect(keys).toContain(group.key);
    expect(keys.includes('behind')).toBe(behindOperations(model).length > 0);
  });
});

describe('flow view', () => {
  it('says what the plan does to a flow', async () => {
    const model = await load('delivery-promise');
    expect(flowView(model, 'flow:browse-product').claim).toBe(
      'Look at a product: three steps change, one step is added.',
    );
    const added = flowView(model, 'flow:propagate-promise');
    expect(added.claim).toMatch(/: new with this plan, six steps\.$/u);
    expect(added.option).toMatch(/ · New$/u);
  });

  it('calls a flow more than one scenario walks shared', async () => {
    const model = await load('delivery-promise');
    expect(flowView(model, 'flow:checkout').lines[0]?.label).toBe(
      'Recorded trigger for this shared flow',
    );
    expect(flowView(model, 'flow:track-order').lines[0]?.label).toBe('Starts when');
  });

  it('says so when nothing changes', async () => {
    const model = await load('storefront-graph');
    expect(flowView(model, 'flow:sync-stock').claim).toBe('Keep stock in sync: nothing changes.');
  });
});

describe('execution', () => {
  it('leads with the first sentence of the summary and links a cited flow to its page', async () => {
    const model = await load('delivery-promise');
    const story = executionStory(model);
    expect(story?.headline).toBe(
      'One promise, created once, copied to every place the shopper looks, frozen on the order.',
    );
    const pages = new Set(journeyGroups(model).map((g) => g.key));
    const linked = story?.paths.flatMap((p) => p.steps).filter((s) => s.page !== null) ?? [];
    for (const step of linked) expect(pages.has(step.page ?? '')).toBe(true);
  });
});

describe('behind the button', () => {
  it('has nothing to say for a plan with no operations', async () => {
    expect(behindStory(await load('invoice-vat-number'))).toEqual([]);
  });

  it('costs each operation in time, round trips and teams, and names whom to call', async () => {
    const stories = behindStory(await load('storefront-graph'));
    const page = stories.find((s) => s.id === 'gql:product-page');
    expect(page?.headline).toBe(
      'Showing the product page takes 15 ms when the edge cache has it and about 120 ms when nothing does.',
    );
    expect(page?.when).toBe('when the page loads');
    expect(page?.gateway).toEqual({ team: 'team:storefront', decides: true });
    expect(page?.purges.rows.length).toBeGreaterThan(0);
    expect(page?.purges.flow).toBe('flow:price-change-purge');
    expect(page?.change).toBe('a subgraph is swapped');
    const cart = stories.find((s) => s.id === 'gql:add-to-cart');
    expect(cart?.headline).toBe(
      'Add to cart is never cached: it takes one round trip across two teams, every time.',
    );
    expect(cart?.cache?.text).toBe('A mutation is never cached.');
  });

  it('keeps an override’s note only when it says something', async () => {
    const stories = behindStory(await load('storefront-graph'));
    expect(stories.find((s) => s.id === 'gql:product-reviews')?.cache?.note).toBeNull();
  });

  it('puts operations in the order of the screens that send them', async () => {
    const model = await load('storefront-graph');
    const ids = behindOperations(model).map((o) => o.id);
    expect(ids.indexOf('gql:product-page')).toBeLessThan(ids.indexOf('gql:product-reviews'));
  });
});

describe('purges', () => {
  it('says how long a layer keeps what no event purges', () => {
    expect(expiryOf('blocked', 60)).toBe('keeps nothing of this operation');
    expect(expiryOf('ready', null)).toBe('expires on a timer');
    expect(expiryOf('ready', 0)).toBe('expires on a timer');
    expect(expiryOf('ready', 60)).toBe('expires after 60 s');
  });

  it('names the events that purge each layer and the way they do it', async () => {
    const model = await load('storefront-graph');
    const [edge] = purgesOf(model, 'gql:product-page').rows;
    expect(edge?.store).toBe('st:edge-cache');
    expect(edge?.events).toContain('msg:stock-changed');
    expect(edge?.expires).toBeNull();
    expect(edge?.mechanism).toBe('surrogate key per sku, sent by the cache purger');
  });
});

describe('execution of every plan', () => {
  it.each(PLANS)('%s: a step links to a page of the journey chapter or to none', async (plan) => {
    const model = await load(plan);
    const pages = new Set(journeyScreens(model).map((s) => s.key));
    const steps = executionStory(model)?.paths.flatMap((p) => p.steps) ?? [];
    expect(steps.length).toBeGreaterThan(1);
    for (const step of steps) expect(step.page === null || pages.has(step.page)).toBe(true);
  });
});

async function bare() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'storefront-graph');
  if (loaded.plan === null) throw new Error('no plan');
  const plan = structuredClone(loaded.plan);
  for (const op of plan.operations ?? []) {
    delete op.screens;
    delete op.trigger;
    delete op.summary;
    for (const use of op.cache ?? []) delete use.reason;
  }
  return derive(plan);
}

describe('an operation the plan says little about', () => {
  it('is placed on the page, sent by the front end, and costed from its fields alone', async () => {
    const stories = behindStory(await bare());
    const page = stories.find((s) => s.id === 'gql:product-page');
    expect(page?.screen).toBeNull();
    expect(page?.when).toBe('by the front end');
    expect(page?.headline).toMatch(/^Showing the page takes/u);
    expect(page?.lede).toMatch(/^\d+ fields? · /u);
    expect(page?.cache?.note).toMatch(/s the rules give: $/u);
  });
});

async function facts() {
  const model = await load('storefront-graph');
  const op = (model.plan.operations ?? []).find((o) => o.id === 'gql:product-page');
  if (op === undefined) throw new Error('no operation');
  return { model, op, base: waterfallFacts(model, op.id, 'asIs') };
}

describe('what a place on a screen costs', () => {
  it('gives the measured time of a hit and a miss, of a miss alone, or the round trips', async () => {
    const { model, op, base } = await facts();
    const both = { ...base, layerObserved: true, layerHit: 20, layerCold: 300, hitLayer: null };
    expect(behindHeadline(model, op, both)).toMatch(/takes 20 ms when the .+ cache has it/u);
    const cold = { ...base, layerObserved: true, layerHit: null, layerCold: 300 };
    expect(behindHeadline(model, op, cold)).toMatch(/about 300 ms, across /u);
    const unmeasured = { ...base, layerObserved: false };
    expect(behindHeadline(model, op, unmeasured)).toMatch(/round trips? across /u);
  });

  it('says a private response is never kept at the edge, and a mutation never cached', async () => {
    const { model, op, base } = await facts();
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
