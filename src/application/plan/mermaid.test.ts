import { describe, expect, it } from 'vitest';

import { quickCheckoutOnToday } from '@/../test/fixtures/acme/plans/core-checkout';
import { giftWrap } from '@/../test/fixtures/acme/plans/journeys-gift-wrap';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { orderEventV2 } from '@/../test/fixtures/acme/plans/versions-order-event';
import { coreShop } from '@/../test/fixtures/core-shop';
import { modelOf } from '@/../test/plan-kit';
import { flowSteps } from '@/application/plan/flow-steps';
import { flowToMermaid, mmText } from '@/application/plan/mermaid';
import type { Flow, Plan, Step } from '@/domain/plan/plan.generated';

const MODES = ['toBe', 'asIs', 'diff'] as const;
const ENTITY = /#(?:35|59|lt|gt);/gu;

const checkout = modelOf(quickCheckoutOnToday().plan);
const all = [
  { slug: 'quick-checkout', m: checkout },
  { slug: 'pause-orders', m: modelOf(pauseOrders()) },
  { slug: 'gift-wrap', m: modelOf(giftWrap()) },
  { slug: 'order-event-v2', m: modelOf(orderEventV2()) },
  { slug: 'shop', m: modelOf(coreShop()) },
];

const word = (line: string): string => line.trim().split(' ')[0] ?? '';

/** What is wrong with the alt/rect blocks of a drawing: an else outside an alt, an end with nothing to close, a block left open. */
function blockProblems(text: string): string[] {
  const stack: string[] = [];
  const problems: string[] = [];
  for (const line of text.split('\n')) {
    const kw = word(line);
    if (kw === 'alt' || kw === 'rect') stack.push(kw);
    else if (kw === 'else' && stack.at(-1) !== 'alt') problems.push('else outside an alt');
    else if (kw === 'end' && stack.pop() === undefined) problems.push('end closes nothing');
  }
  return [...problems, ...stack.map((k) => `${k} left open`)];
}

const hasLine = (text: string, start: string): boolean =>
  text.split('\n').some((l) => l.trim().startsWith(start));

/** Every flow of every plan, drawn in every mode it exists in. */
const drawings = all.flatMap(({ slug, m }) =>
  m.toBe.flows.flatMap((f) =>
    MODES.filter((mode) => mode !== 'asIs' || m.asIs.flows.some((a) => a.id === f.id)).map(
      (mode) => ({
        where: `${slug} ${f.id} ${mode}`,
        m,
        id: f.id,
        mode,
        text: flowToMermaid(m, f.id, { mode }),
      }),
    ),
  ),
);

describe('flowToMermaid', () => {
  it('draws something for every plan', () => {
    expect(drawings.length).toBeGreaterThan(10);
  });

  it('starts as a numbered sequence diagram', () => {
    for (const d of drawings) {
      const lines = d.text.split('\n');
      expect(lines[0], d.where).toBe('sequenceDiagram');
      expect(lines[1]?.trim(), d.where).toBe('autonumber');
    }
  });

  it('gives participants short ids, with the person first in a flow someone starts', () => {
    const out = flowToMermaid(checkout, 'flow:place-order');
    expect(out).toMatch(/^ {2}actor P as Customer$/mu);
    expect(out.indexOf('actor P')).toBeLessThan(out.indexOf('participant S1'));
    const participants = drawings.flatMap((d) =>
      d.text.split('\n').flatMap((line) => {
        const p = /^\s*participant (\S+) as /u.exec(line);
        return p === null ? [] : [{ id: p[1], at: `${d.where}: ${line}` }];
      }),
    );
    for (const { id, at } of participants) expect(id, at).toMatch(/^[A-Z]\d*$/u);
  });

  it('shows every step once, in order', () => {
    for (const d of drawings) {
      let from = 0;
      for (const s of flowSteps(d.m, d.id, d.mode)) {
        if (s.action === '') continue;
        const k = d.text.indexOf(mmText(s.action), from);
        expect(k, `${d.where}: "${s.action}" in order`).toBeGreaterThanOrEqual(from);
        from = k + 1;
      }
    }
  });

  it('keeps authored conditions and recovery as notes, never inferred branches', () => {
    const out = flowToMermaid(checkout, 'flow:place-order', { mode: 'asIs' });
    expect(out).toMatch(/Note over S\d+,S\d+: Only when the customer pays by card\./u);
    expect(out).toMatch(/Note over S\d+: The customer presses Place order on the basket\./u);
    expect(out).not.toMatch(/\b(?:alt|opt) Only when the customer pays by card/u);
    expect(flowToMermaid(checkout, 'flow:place-order')).toMatch(
      /Note over S\d+,S\d+: Only when the customer pays by card or wallet\./u,
    );
    const job = flowToMermaid(checkout, 'flow:reindex-search', { mode: 'asIs' });
    expect(job).toMatch(/Note over S\d+: Every night a job rebuilds the index\./u);
    expect(job).toMatch(/Note over S\d+: Pick the changed products$/mu);
  });

  it('groups a shared event source or a beat neutrally, never as parallel execution', () => {
    const out = flowToMermaid(checkout, 'flow:publish-product');
    expect(hasLine(out, 'rect rgba')).toBe(true);
    expect(out).toContain('from the same event source');
    for (const d of drawings) {
      expect(hasLine(d.text, 'par ') || hasLine(d.text, 'and '), d.where).toBe(false);
      expect(d.text, d.where).not.toContain('at the same time');
    }
  });

  it('balances alt and rect blocks, and puts every else in an alt', () => {
    for (const d of drawings) expect(blockProblems(d.text), d.where).toEqual([]);
  });

  it('carries no markup Mermaid would misread', () => {
    for (const d of drawings) {
      expect(d.text, d.where).not.toContain('<');
      expect(d.text, d.where).not.toMatch(/\*\*|`|\]\(/u);
      const bare = d.text.replaceAll(ENTITY, '');
      expect(bare.includes(';') || bare.includes('#'), d.where).toBe(false);
    }
    expect(mmText('Pay **now**; see [the page](x) <b> #1')).toBe(
      'Pay now#59; see the page #lt;b#gt; #35;1',
    );
    expect(mmText('see [[svc:orders]] and [[fld:order#total]]')).toBe('see orders and total');
    expect(mmText()).toBe('');
  });

  it('draws a failure as alt … else if it fails … end, and each removed step as a removed note', () => {
    expect(hasLine(flowToMermaid(checkout, 'flow:place-order'), 'else if it fails')).toBe(true);
    expect(flowToMermaid(checkout, 'flow:publish-product', { mode: 'diff' })).toMatch(
      /Note over S\d+: removed · Log the save/u,
    );
    const removed = drawings
      .filter((d) => d.mode === 'diff')
      .map((d) => ({
        drawn: (d.text.match(/: removed · /gu) ?? []).length,
        steps: flowSteps(d.m, d.id, 'diff').filter((s) => s.$removed === true).length,
      }));
    expect(removed.reduce((n, r) => n + r.drawn, 0)).toBe(removed.reduce((n, r) => n + r.steps, 0));
    expect(removed.reduce((n, r) => n + r.steps, 0)).toBeGreaterThan(0);
  });

  it('is pure: the same flow gives the same text', () => {
    expect(flowToMermaid(checkout, 'flow:place-order')).toBe(
      flowToMermaid(checkout, 'flow:place-order'),
    );
  });
});

function sequencePlan(steps: Step[], extra: Partial<Flow> = {}): Plan {
  return {
    meta: { id: 'sequence', title: 'Read a product' },
    problem: { summary: 'Export the recorded sequence.' },
    teams: [],
    services: [
      { id: 'svc:web', name: 'Store **front**', kind: 'ui' },
      { id: 'svc:products', name: 'Products', kind: 'service' },
      { id: 'svc:worker', name: 'Worker', kind: 'job' },
    ],
    stores: [
      { id: 'st:events', name: 'Product events', kind: 'topic' },
      { id: 'st:db', name: 'Orders', kind: 'database' },
      { id: 'st:queue', name: 'Queue', kind: 'queue' },
    ],
    schemas: [
      { id: 'sch:product', name: 'Product', kind: 'dto' },
      {
        id: 'sch:order',
        name: 'Order',
        kind: 'record',
        store: 'st:db',
        fields: [{ name: 'id', type: 'string' }],
      },
    ],
    interfaces: [
      {
        id: 'if:products',
        service: 'svc:products',
        protocol: 'rest',
        endpoints: [{ id: 'api:get', sig: 'GET /products', response: 'sch:product' }],
      },
    ],
    messages: [
      {
        id: 'msg:changed',
        name: 'changed',
        version: 'v1',
        topic: 'st:events',
        producer: 'svc:products',
        consumers: ['svc:worker'],
      },
    ],
    screens: [
      { id: 'scr:page', name: 'Product page', service: 'svc:web' },
      { id: 'scr:done', name: 'Receipt', service: 'svc:web' },
    ],
    flows: [{ id: 'flow:sequence', name: 'Sequence', steps, ...extra }],
  };
}
const sequenceStep = (name: string, extra: Partial<Step> = {}): Step => ({
  id: `flow:sequence#${name}`,
  from: 'svc:web',
  to: 'svc:products',
  via: 'api:get',
  action: 'Fetch **items**',
  ...extra,
});

describe('the Mermaid export contract', () => {
  it('exports an actor, recorded screen and trigger, a call and its typed reply as valid Mermaid lines', () => {
    const m = modelOf(
      sequencePlan([sequenceStep('fetch', { screen: 'scr:page', logic: 'Only if needed.' })], {
        actor: 'Customer',
        trigger: 'Press **Buy**.',
      }),
    );
    expect(flowToMermaid(m, 'flow:sequence', { mode: 'asIs' })).toBe(
      [
        'sequenceDiagram',
        '  autonumber',
        '  actor P as Customer',
        '  participant S1 as Store front',
        '  participant S2 as Products',
        '  P->>S1: Product page',
        '  Note over S1: Press Buy.',
        '  Note over S1,S2: Only if needed.',
        '  S1->>S2: Fetch items · GET /products',
        '  S2-->>S1: Product',
      ].join('\n'),
    );
  });
  it('distinguishes event hand-offs, store writes and internal work without inventing a person', () => {
    const m = modelOf(
      sequencePlan([
        sequenceStep('publish', {
          from: 'svc:products',
          to: 'st:events',
          via: 'msg:changed',
          action: 'Announce',
        }),
        sequenceStep('consume', {
          from: 'st:events',
          to: 'svc:worker',
          via: 'msg:changed',
          action: 'Copy',
        }),
        sequenceStep('write', {
          from: 'svc:worker',
          to: 'st:db',
          via: 'internal',
          action: 'Keep order',
          writes: ['sch:order#id', 'sch:order'],
        }),
        sequenceStep('finish', {
          from: 'svc:worker',
          to: 'svc:worker',
          via: 'internal',
          action: 'Finish',
        }),
      ]),
    );
    expect(flowToMermaid(m, 'flow:sequence')).toBe(
      [
        'sequenceDiagram',
        '  autonumber',
        '  participant S1 as Products',
        '  participant T1 as Product events',
        '  participant S2 as Worker',
        '  participant D1 as Orders',
        '  S1-)T1: Announce · changed v1',
        '  T1-)S2: Copy · changed v1',
        '  S2->>D1: Keep order · writes Order',
        '  Note over S2: Finish',
      ].join('\n'),
    );
  });
  it('keeps failure branches and recorded grouping distinct, and does not relabel grouping as parallelism', () => {
    const m = modelOf(
      sequencePlan([
        sequenceStep('one', { fails: 'Unavailable', beat: 'Load' }),
        sequenceStep('two', { beat: 'Load' }),
      ]),
    );
    expect(flowToMermaid(m, 'flow:sequence')).toBe(
      [
        'sequenceDiagram',
        '  autonumber',
        '  participant S1 as Store front',
        '  participant S2 as Products',
        '  rect rgba(128, 128, 128, 0.12)',
        '    Note over S1,S2: Load',
        '    alt Fetch items',
        '      S1->>S2: Fetch items · GET /products',
        '      S2-->>S1: Product',
        '    else if it fails',
        '      Note over S1,S2: Unavailable',
        '    end',
        '    S1->>S2: Fetch items · GET /products',
        '    S2-->>S1: Product',
        '  end',
      ].join('\n'),
    );
  });
  it('shows a removed step as a note, leaves an unread call detail blank, and uses a visible id for a missing action', () => {
    const value = sequencePlan(
      [sequenceStep('one'), sequenceStep('two', { action: '', via: 'api:unread' })],
      { actor: 'Customer' },
    );
    value.changes = [
      { id: 'chg:remove', title: 'Stop fetching', ops: [{ remove: 'flow:sequence#one' }] },
    ];
    const out = flowToMermaid(modelOf(value), 'flow:sequence', { mode: 'diff' });
    expect(out).toContain('  P->>S1: Starts');
    expect(out).toContain('  Note over S1,S2: removed · Fetch items');
    expect(out).toContain('  S1->>S2: flow:sequence#35;two');
    expect(out).not.toContain('api:unread');
    expect(flowToMermaid(modelOf(value), 'flow:missing')).toBe('sequenceDiagram\n  autonumber');
  });
  it('keeps data reads, queue participant identities and changes of screen in the export', () => {
    const m = modelOf(
      sequencePlan(
        [
          sequenceStep('read', {
            from: 'svc:web',
            to: 'st:db',
            via: 'internal',
            action: 'Read order',
            reads: ['sch:order', 'sch:order#id'],
            screen: 'scr:page',
          }),
          sequenceStep('move', {
            from: 'svc:web',
            to: 'st:queue',
            via: 'internal',
            action: 'Queue work',
            screen: 'scr:done',
          }),
        ],
        { actor: 'Customer' },
      ),
    );
    expect(flowToMermaid(m, 'flow:sequence')).toBe(
      [
        'sequenceDiagram',
        '  autonumber',
        '  actor P as Customer',
        '  participant S1 as Store front',
        '  participant D1 as Orders',
        '  participant T1 as Queue',
        '  P->>S1: Product page',
        '  S1->>D1: Read order · reads Order',
        '  S1->>T1: Queue work',
        '  Note over P: sees Receipt',
      ].join('\n'),
    );
  });
  it('exports plain labels with reserved characters escaped and leaves absent text blank', () => {
    expect(
      mmText(
        ' **Bold** *light* __under__ ***strong*** `code` [label](https://example.com) [[sch:item#field]] <tag>;#\n  more ',
      ),
    ).toBe('Bold light under strong code label field #lt;tag#gt;#59;#35; more');
    expect(mmText()).toBe('');
  });
});
