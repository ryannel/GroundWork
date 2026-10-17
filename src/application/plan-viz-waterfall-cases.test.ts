import { describe, expect, it, vi } from 'vitest';

vi.mock(import('server-only'), () => ({}));

const { derive } = await import('@/application/plan/derive');
const { shop, byId } = await import('@/../test/federation-kit');
const { waterfallView } = await import('@/application/plan-viz-waterfall-body');
const { opPlan, routerWhy, waterfallFacts } =
  await import('@/application/plan-viz-waterfall-facts');

const asIs = { mode: 'asIs' } as const;
const shopModel = derive(shop());

const fetchesOf = (id: string, kase: string, mode: 'asIs' | 'toBe' = 'asIs') => {
  const rows = waterfallView(shopModel, id, { mode })?.bodies.find((b) => b.kase === kase)?.rows;
  return (rows ?? []).flatMap((r) => (r.kind === 'fetch' ? [r] : []));
};

describe('the waterfall when a cache answers only part of the plan', () => {
  const cart = waterfallView(shopModel, 'gql:cart-summary', asIs);

  it('offers the gateway hit and the cold path, since the edge cannot serve a private cart', () => {
    expect(cart?.cases.map((c) => c.label)).toEqual(['gateway hit', 'cold']);
    expect(cart?.times).toBeNull();
  });

  it('says what the cache answered and what still ran', () => {
    const hit = cart?.bodies.find((b) => b.kase === 'hit');
    expect(hit?.caption).toBe(
      'The entity cache answers the Product and Pricing pieces; Cart still runs, so the response still waits on a round trip.',
    );
    expect(hit?.summary).toBe('entity cache answered 2 of 3 fetches; 1 still ran');
  });

  it('blocks the edge cache with the reason', () => {
    const rows = cart?.bodies[0]?.rows.flatMap((r) => (r.kind === 'cache' ? [r] : [])) ?? [];
    expect(rows[0]).toMatchObject({ layer: 'edge', state: 'blocked' });
    expect(rows[0]?.why).toEqual({
      kind: 'private',
      field: expect.stringContaining('cart') as string,
    });
  });
});

describe('the case a flow step lands on', () => {
  it('opens on the case the step asks for', () => {
    const p = shop();
    const step = (p.flows ?? []).flatMap((f) => f.steps).find((s) => s.via === 'gql:product-page');
    if (step !== undefined) step.case = 'hit';
    const model = derive(p);
    expect(waterfallView(model, 'gql:product-page', { stepId: step?.id })?.landing).toBe('hit');
    expect(waterfallView(model, 'gql:product-page', { stepId: 'flow:nowhere#x' })?.landing).toBe(
      'cold',
    );
    expect(waterfallView(model, 'gql:product-page', { stepId: null })?.landing).toBe('cold');
  });
});

describe('the fetches of a waterfall', () => {
  it('shows one call carrying every item, and a query for each item with no batching', () => {
    const [, products, reviews] = fetchesOf('gql:search-reviews', 'cold');
    expect(products?.batch).toEqual({
      text: 'all the products in 1 call',
      title: 'One call carries all the products',
      warn: false,
    });
    expect(reviews?.batch).toMatchObject({ text: 'n queries inside Reviews', warn: true });
  });

  it('marks the gateway cache on each fetch it can serve', () => {
    const marks = fetchesOf('gql:search-reviews', 'cold').map((f) => f.gateCache?.text ?? null);
    expect(marks).toEqual(['gateway cache miss', null, 'gateway cache miss']);
    const hit = fetchesOf('gql:search-reviews', 'miss').map((f) => f.gateCache?.kind);
    expect(hit).toContain('hit');
    expect(fetchesOf('gql:search-reviews', 'hit').map((f) => f.gateCache?.kind)).toContain('skip');
  });

  it('says which fields the gateway added itself, and why', () => {
    const plan = opPlan(shopModel, 'gql:product-page', 'toBe');
    const added = plan?.addedByRouter.find((x) => x.reason === 'requires');
    const why =
      plan === null || added === undefined ? null : routerWhy(shopModel, plan, added.path);
    expect(why).toEqual({
      label: 'for deliveryPromise',
      tip: 'Added by the gateway for deliveryPromise',
    });
  });
});

describe('the waterfall when only a data cache can hit', () => {
  const p = shop();
  delete byId(p.stores, 'st:entity-cache').layer;
  const model = derive(p);

  it('has no gateway row, and marks the data cache on the fetch that reads it', () => {
    const view = waterfallView(model, 'gql:product-page', asIs);
    expect(view?.cases.map((c) => c.kase)).toEqual(['hit', 'cold']);
    const cold = view?.bodies.find((b) => b.kase === 'cold');
    const reads = cold?.rows.flatMap((r) => (r.kind === 'fetch' ? r.reads : [])) ?? [];
    expect(reads.find((r) => r.kind === 'cache')?.mark).toMatchObject({ kind: 'miss' });
    expect(cold?.summary).toBe('2 round trips · 3 fetches · 3 teams');
  });
});

describe('an operation the to-be plan does not have', () => {
  it('has no as-is waterfall', () => {
    expect(waterfallView(shopModel, 'gql:promise', asIs)).toBeNull();
    expect(waterfallFacts(shopModel, 'gql:promise', 'asIs').plan).toBeNull();
  });
});
