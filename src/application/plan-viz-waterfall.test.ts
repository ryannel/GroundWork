import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const { derive } = await import('@/application/plan/derive');
const text = await import('@/application/plan-viz-waterfall-text');
const { waterfallView } = await import('@/application/plan-viz-waterfall-body');
const { waterfallFacts, fieldsOfFetch, routerWhy, opPlan, keyOf, modeKey } =
  await import('@/application/plan-viz-waterfall-facts');
const { waterfallCases, landingCase, nameOf } =
  await import('@/application/plan-viz-waterfall-words');
const { compare } = await import('@/application/plan-viz-waterfall-compare');

const shop = derive(await loadFixture('shop.yaml'));
const PAGE = 'gql:product-page';

describe('the waterfall wordings', () => {
  it('writes times, and long whole minutes as minutes', () => {
    expect(text.ms(15)).toBe('15 ms');
    expect(text.secs(30)).toBe('30 s');
    expect(text.secs(90)).toBe('90 s');
    expect(text.secs(600)).toBe('10 min');
  });

  it('lists in words and pluralises without doubling an s', () => {
    expect(text.andList([])).toBe('');
    expect(text.andList(['a'])).toBe('a');
    expect(text.andList(['a', 'b', 'c'])).toBe('a, b and c');
    expect(text.plural('review')).toBe('reviews');
    expect(text.plural('news')).toBe('news');
  });

  it('turns a cache key into words', () => {
    const key = { operation: 'id', variables: ['sku'], headers: ['Accept-Language'] } as const;
    expect(text.keyText({ ...key, variables: ['sku'], headers: ['Accept-Language'] })).toBe(
      'persisted id · sku · language header',
    );
    expect(text.keyText({ operation: 'hash', variables: 'all' })).toBe('hash · all');
    expect(text.keyText('operation id · variables · Accept-Language')).toBe(
      'operation id · variables · language header',
    );
    expect(text.keyText('operation id · Accept-Encoding')).toBe(
      'operation id · accept encoding header',
    );
    expect(text.keyText(null)).toBe('');
    expect(text.keyText()).toBe('');
  });

  it('turns type strings in a failure sentence into words', () => {
    expect(text.humanBlast('if `[Review!]!` is null')).toBe(
      'if a list of reviews that must exist comes back empty',
    );
    expect(text.humanBlast('`[LineItem]` are null')).toBe('a list of line items come back empty');
    expect(text.humanBlast('product.price is `Money!`')).toBe('product.price is a required Money');
    expect(text.humanBlast('x is non-null')).toBe('x is required');
  });
});

describe('what the shop product page says about its waterfall', () => {
  const facts = waterfallFacts(shop, PAGE);

  it('counts the plan', () => {
    expect([facts.roundTrips, facts.fetches, facts.teams]).toEqual([3, 4, 3]);
    expect(facts.mutation).toBe(false);
    expect(facts.hitLayerName).toBe('edge');
    expect(facts.layerHit).toBe(15);
    expect(facts.layerCold).toBe(120);
    expect(facts.cacheLayers).toBe(2);
  });

  it('has no plan for something that is not an operation', () => {
    expect(opPlan(shop, 'svc:web')).toBeNull();
    expect(waterfallFacts(shop, 'svc:web').plan).toBeNull();
    expect(waterfallView(shop, 'svc:web')).toBeNull();
  });

  it('reads the mode', () => {
    expect(modeKey('toBe')).toBe('toBe');
    expect(modeKey('asIs')).toBe('asIs');
    expect(modeKey()).toBe('toBe');
  });

  it('offers a hit, a miss and the cold path, and lands on the one asked for', () => {
    const cases = waterfallCases(shop, PAGE);
    expect(cases.map((c) => c.label)).toEqual(['edge hit', 'edge miss', 'cold']);
    expect(landingCase(cases, 'miss')).toBe('miss');
    expect(landingCase(cases, 'warm')).toBe('cold');
    expect(landingCase(cases, null)).toBe('cold');
  });

  it('names a subgraph without the word', () => {
    expect(nameOf(shop, 'sg:pricing-v2')).toBe('Pricing v2');
  });

  it('lists the direct fields of each fetch', () => {
    const plan = opPlan(shop, PAGE);
    const names = (plan?.fetches ?? []).map((f) =>
      plan === null ? [] : fieldsOfFetch(plan, f).map((x) => x.name),
    );
    expect(names.flat()).toEqual(expect.arrayContaining(['sku', 'price', 'stock']));
  });

  it('gives the key an entity fetch is looked up by', () => {
    const entity = opPlan(shop, PAGE)?.fetches.find((f) => f.kind === 'entity');
    expect(entity === undefined ? '' : keyOf(shop, entity)).toBe('sku');
  });

  it('says nothing of the gateway for a path it did not add', () => {
    const plan = opPlan(shop, PAGE);
    expect(plan === null ? null : routerWhy(shop, plan, 'product.nope')).toBeNull();
  });
});

describe('the waterfall of the shop product page', () => {
  const view = waterfallView(shop, PAGE);
  const body = (kase: string) => view?.bodies.find((b) => b.kase === kase);
  const kinds = (kase: string) => body(kase)?.rows.map((r) => r.kind);

  it('has a control and a body for each case, opening cold', () => {
    expect(view?.withControl).toBe(true);
    expect(view?.landing).toBe('cold');
    expect(view?.bodies.map((b) => b.kase)).toEqual(['hit', 'miss', 'cold']);
    expect(view?.title).toBe('Who answers, and how long each takes');
    expect(view?.times?.text).toBe('edge cache averages: hit 15 ms · miss 120 ms');
  });

  it('puts the caches first, then the gateway, then each round trip', () => {
    expect(kinds('cold')).toEqual([
      'cache',
      'cache',
      'hinge',
      'band',
      'fetch',
      'band',
      'fetch',
      'fetch',
      'band',
      'fetch',
      'fill',
    ]);
  });

  it('says who answers in a caption and a summary', () => {
    expect(body('hit')?.caption).toBe(
      'The edge cache has the answer here, so nothing below it runs.',
    );
    expect(body('hit')?.summary).toBe('edge cache answered; nothing below it ran');
    expect(body('miss')?.caption).toContain('the next layer still had the answer');
    expect(body('cold')?.summary).toContain('3 round trips');
  });

  it('skips the fetches an edge hit answers for', () => {
    const fetches = body('hit')?.rows.flatMap((r) => (r.kind === 'fetch' ? [r] : [])) ?? [];
    expect(fetches).toHaveLength(4);
    expect(fetches.every((f) => f.state === 'skipped' && f.bar.skipped)).toBe(true);
  });

  it('marks each cache layer by what it did', () => {
    const rows = body('miss')?.rows.flatMap((r) => (r.kind === 'cache' ? [r] : [])) ?? [];
    expect(rows.map((r) => [r.layer, r.state, r.mark.kind])).toEqual([
      ['edge', 'miss', 'miss'],
      ['gateway', 'hit', 'hit'],
    ]);
    expect(rows[0]?.meta).toContain('cached for 10 min');
  });

  it('shows what fails with each fetch, in words', () => {
    const rows = body('cold')?.rows.flatMap((r) => (r.kind === 'fetch' ? [r] : [])) ?? [];
    expect(rows[1]?.blast).toBe(
      'if Pricing v2 fails, product comes back empty because product.price is a required Money',
    );
    expect(rows[1]?.bar.calls).toBe('svc:pricing-api');
    expect(rows[1]?.reads.map((r) => r.kind)).toEqual(['cache', 'via', 'store']);
  });

  it('names the round trips and what runs in parallel', () => {
    const bands = body('cold')?.rows.flatMap((r) => (r.kind === 'band' ? [r.text] : [])) ?? [];
    expect(bands).toEqual([
      'round trip 1',
      'round trip 2 · 2 in parallel · by key sku',
      'round trip 3 · by key sku',
    ]);
  });

  it('opens on the case asked for', () => {
    expect(waterfallView(shop, PAGE, { kase: 'miss' })?.landing).toBe('miss');
    expect(waterfallView(shop, PAGE, { kase: 'warm' })?.landing).toBe('cold');
  });
});

describe('the compact waterfall', () => {
  it('shows one case, only the layers that answered, and no headings', () => {
    const view = waterfallView(shop, PAGE, { compact: true, kase: 'miss' });
    expect(view?.withControl).toBe(false);
    expect(view?.bodies).toHaveLength(1);
    const rows = view?.bodies[0]?.rows ?? [];
    expect(rows.some((r) => r.kind === 'band' || r.kind === 'hinge' || r.kind === 'fill')).toBe(
      false,
    );
    expect(rows.filter((r) => r.kind === 'cache')).toHaveLength(1);
    expect(view?.bodies[0]?.caption).toBeNull();
  });

  it('dims the fetches of other teams under a lens', () => {
    const view = waterfallView(shop, PAGE, { kase: 'cold', lens: 'team:catalog' });
    const lenses = (view?.bodies[0]?.rows ?? []).flatMap((r) =>
      r.kind === 'fetch' ? [r.lens] : [],
    );
    expect(lenses).toEqual(['mine', 'faded', 'faded', 'faded']);
  });
});

describe('the waterfall of a mutation', () => {
  const view = waterfallView(shop, 'gql:add-to-cart');

  it('says it is never cached, with no control', () => {
    expect(view?.mutation).toBe(true);
    expect(view?.withControl).toBe(false);
    expect(view?.note).toBe('mutations are never cached');
    expect(view?.title).toBe('What it writes, and who answers');
  });
});

describe('the waterfall of the plan against today', () => {
  const view = waterfallView(shop, PAGE, { mode: 'toBe', diff: true });
  const fetches = (view?.bodies[0]?.rows ?? []).flatMap((r) => (r.kind === 'fetch' ? [r] : []));

  it('draws one body, headed as the plan', () => {
    expect(view?.diff).toBe(true);
    expect(view?.title).toBe('Who answers, with this plan');
    expect(view?.bodies).toHaveLength(1);
  });

  it('says how the plan moved the numbers', () => {
    expect(view?.bodies[0]?.summary).toContain('2 → 3 round trips');
    expect(view?.bodies[0]?.summary).toContain('3 → 4 fetches');
  });

  it('marks new fetches and the ones that moved', () => {
    const kinds = fetches.map((f) => f.change?.kind);
    expect(kinds).toContain('add');
    const after = opPlan(shop, PAGE, 'toBe');
    const cmp = after === null ? null : compare(shop, PAGE, after);
    expect(cmp?.before?.roundTrips).toBe(2);
    expect(cmp?.changes.size).toBeGreaterThan(0);
  });

  it('compares nothing for an operation that is new', () => {
    const plan = opPlan(shop, PAGE);
    expect(plan).not.toBeNull();
    const cmp = plan === null ? null : compare(shop, 'gql:nowhere', plan);
    expect(cmp?.before).toBeNull();
    expect(cmp?.gone).toEqual([]);
  });
});
