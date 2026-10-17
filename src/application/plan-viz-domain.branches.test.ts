import { describe, expect, it } from 'vitest';

import { modelOf } from '@/../test/plan-kit';
import { acme } from '@/../test/workspace-kit';
import {
  conceptCards,
  type DomainView,
  domainView,
  namesPlan,
  narrowedTo,
} from '@/application/plan-viz-domain';
import type { Concept, Plan } from '@/domain/plan/plan.generated';

const today = acme().today.plan;

const withConcepts = (concepts: readonly Concept[], summary?: string): Plan => ({
  ...today,
  domain: {
    ...(summary === undefined ? {} : { summary }),
    concepts: [...concepts],
    stages: today.domain?.stages ?? [],
  },
});

const model = modelOf(today);
const view = (concepts: readonly Concept[]): DomainView => ({ summary: '', concepts, added: [] });

describe('domainView', () => {
  const concepts: readonly Concept[] = [
    {
      id: 'con:order',
      name: 'Order',
      means: 'What a customer buys.',
      born_in: 'svc:order-api',
      aka: [
        { in: 'svc:shop-bff', as: 'Purchase', at: 'sch:order' },
        { in: 'svc:shop-bff', as: 'Cart', at: 'sch:new-thing' },
        { in: 'svc:order-api', as: 'Order' },
      ],
    },
    { id: 'con:gift', name: 'Gift', means: 'A wrapped order.', introduced_by: ['chg:gift'] },
    { id: 'con:voucher', name: 'Voucher', means: 'Money off.', born_in: 'svc:vouchers' },
  ];
  const m = modelOf(withConcepts(concepts));

  it('gives every concept as the plan tells it, with no summary when it has none', () => {
    expect(domainView(m, false)).toEqual({ summary: '', concepts, added: [] });
  });

  it('keeps to what runs today: no new concepts, and no names or births in what the plan adds', () => {
    const seen = domainView(m, true);
    expect(seen.added.map((c) => c.id)).toEqual(['con:gift']);
    expect(
      seen.concepts.map((c) => [c.id, c.born_in ?? null, (c.aka ?? []).map((a) => a.as)]),
    ).toEqual([
      ['con:order', 'svc:order-api', ['Purchase', 'Order']],
      ['con:voucher', null, []],
    ]);
  });

  it('reads an empty domain when the plan has none', () => {
    const { domain, ...bare } = today;
    expect(domain?.concepts).not.toHaveLength(0);
    expect(domainView(modelOf(bare), true)).toEqual({ summary: '', concepts: [], added: [] });
    expect(domainView(model, false).summary).toContain('A **product**');
  });
});

describe('narrowedTo', () => {
  it('keeps only the concepts named, or all of them when none are', () => {
    const all = domainView(model, false);
    const lens: { readonly only?: readonly string[] } = {};
    expect(narrowedTo(all, lens.only)).toBe(all);
    expect(narrowedTo(all, ['con:order', 'con:nothing']).concepts.map((c) => c.id)).toEqual([
      'con:order',
    ]);
  });
});

describe('conceptCards', () => {
  it('relates a concept to the whole it is part of, what it relates to, and its parts', () => {
    const cards = conceptCards(domainView(model, false));
    expect(cards.map((c) => [c.id, c.bornIn, c.isNew, c.relations])).toEqual([
      ['con:product', 'svc:products', false, []],
      [
        'con:order',
        'svc:order-api',
        false,
        [
          { as: 'is settled by', to: 'con:payment' },
          { as: 'has', to: 'con:order-line' },
        ],
      ],
      ['con:order-line', 'svc:order-api', false, [{ as: 'part of', to: 'con:order' }]],
      ['con:payment', 'svc:payments', false, []],
    ]);
  });

  it('drops relations to concepts left out, but keeps those to other kinds of thing', () => {
    const narrowed = narrowedTo(domainView(model, false), ['con:order-line', 'con:order']);
    const order = conceptCards(narrowed).find((c) => c.id === 'con:order');
    expect(order?.relations).toEqual([{ as: 'has', to: 'con:order-line' }]);
    const loose = conceptCards(
      view([
        {
          id: 'con:x',
          name: 'X',
          means: 'x',
          part_of: 'con:gone',
          relates: [{ to: 'svc:order-api', as: 'lives in' }],
          introduced_by: ['chg:x'],
        },
      ]),
    );
    expect(loose).toEqual([
      {
        id: 'con:x',
        name: 'X',
        means: 'x',
        isNew: true,
        bornIn: null,
        relations: [{ as: 'lives in', to: 'svc:order-api' }],
      },
    ]);
  });
});

describe('namesPlan', () => {
  it('says nothing when no concept has a second name', () => {
    expect(namesPlan(model, view([{ id: 'con:a', name: 'A', means: 'a' }]))).toEqual({
      kind: 'none',
      columns: [],
      rows: [],
      lines: [],
    });
  });

  it('writes a line per concept with a second name, folding the same name in several systems', () => {
    const plan = namesPlan(
      model,
      view([
        {
          id: 'con:order',
          name: 'Order',
          means: 'o',
          born_in: 'svc:order-api',
          aka: [
            { in: 'svc:shop-bff', as: 'Purchase', at: 'sch:order' },
            { in: 'svc:shop-web', as: 'purchase' },
            { in: 'svc:shop-web', as: 'PURCHASE' },
            { in: '', as: 'Purchase' },
            { in: 'svc:order-api', as: 'ORDER' },
            { in: 'svc:payments', as: '' },
          ],
        },
      ]),
    );
    expect(plan.kind).toBe('lines');
    expect(plan.rows).toEqual([]);
    expect(plan.columns).toEqual(['svc:order-api', 'svc:shop-bff', 'svc:shop-web', 'svc:payments']);
    expect(plan.lines).toEqual([
      {
        id: 'con:order',
        name: 'Order',
        names: [{ as: 'Purchase', at: 'sch:order', systems: ['svc:shop-bff', 'svc:shop-web'] }],
      },
    ]);
  });

  it('draws a table when two or more concepts have names in several systems and it is mostly full', () => {
    const plan = namesPlan(
      model,
      view([
        {
          id: 'con:order',
          name: 'Order',
          means: 'o',
          born_in: 'svc:order-api',
          aka: [{ in: 'svc:shop-bff', as: 'Purchase', at: 'sch:order', note: 'in the basket' }],
        },
        {
          id: 'con:product',
          name: 'Product',
          means: 'p',
          born_in: 'svc:products',
          aka: [{ in: 'svc:shop-bff', as: 'Item' }],
        },
        { id: 'con:lonely', name: 'Lonely', means: 'l', born_in: 'svc:mystery', aka: [] },
      ]),
    );
    expect(plan.kind).toBe('table');
    expect(plan.lines).toEqual([]);
    expect(plan.columns).toEqual(['svc:products', 'svc:order-api', 'svc:shop-bff']);
    expect(plan.rows).toEqual([
      {
        id: 'con:order',
        name: 'Order',
        cells: [
          { born: false, names: [] },
          { born: true, names: [] },
          { born: false, names: [{ as: 'Purchase', at: 'sch:order', note: 'in the basket' }] },
        ],
      },
      {
        id: 'con:product',
        name: 'Product',
        cells: [
          { born: true, names: [] },
          { born: false, names: [] },
          { born: false, names: [{ as: 'Item', at: null, note: '' }] },
        ],
      },
    ]);
  });

  it('falls back to lines when a table would be mostly empty', () => {
    const plan = namesPlan(
      model,
      view([
        {
          id: 'con:a',
          name: 'A',
          means: 'a',
          born_in: 'svc:x1',
          aka: [{ in: 'svc:x2', as: 'Ay' }],
        },
        {
          id: 'con:b',
          name: 'B',
          means: 'b',
          born_in: 'svc:x3',
          aka: [{ in: 'svc:x4', as: 'Bee' }],
        },
        {
          id: 'con:c',
          name: 'C',
          means: 'c',
          born_in: 'svc:x5',
          aka: [{ in: 'svc:x6', as: 'Sea' }],
        },
      ]),
    );
    expect(plan.kind).toBe('lines');
    expect(plan.columns).toHaveLength(6);
    expect(plan.lines.map((l) => l.names[0]?.as)).toEqual(['Ay', 'Bee', 'Sea']);
  });
});
