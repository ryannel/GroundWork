import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { derive } from '@/application/plan/derive';
import type { HandlerSource, HandlerStep, Plan } from '@/domain/plan/plan.generated';

import { handlerStoryOf, type StepView } from './today-handler';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const model = derive(await loadFixture('handlers.yaml'));

/** Each step as one line, nested steps indented under their heading. */
function drawn(steps: readonly StepView[], indent = ''): string[] {
  return steps.flatMap((s) => {
    if (s.kind === 'block') {
      return s.branches.flatMap((b) => [`${indent}${b.label}`, ...drawn(b.steps, `${indent}  `)]);
    }
    if (s.kind === 'link') return [`${indent}${s.verb} ${s.chip.id}`];
    return [`${indent}${s.text}`];
  });
}

describe('handlerStoryOf', () => {
  it('reads what runs when an endpoint is called, fork by fork', () => {
    const story = handlerStoryOf(model, 'api:pricing-get-price');
    const [handler] = story?.handlers ?? [];
    expect(handler?.id).toBe('h:pricing-get-price');
    expect(drawn(handler?.steps ?? []).map((l) => l.trim())).toContain('Calls api:fx-get-rate');
    expect(
      handler?.steps.some(
        (s) => s.kind === 'block' && s.branches[0]?.label.startsWith('If ') === true,
      ),
    ).toBe(true);
    expect(handler?.fails).toEqual([{ when: 'the SKU is unknown', result: '404 not_found' }]);
  });

  it('opens what the callee does, and gathers the stores it touches', () => {
    const story = handlerStoryOf(model, 'api:pricing-get-price');
    const steps = story?.handlers[0]?.steps ?? [];
    const flat = (list: readonly StepView[]): StepView[] =>
      list.flatMap((s) => (s.kind === 'block' ? flat(s.branches.flatMap((b) => b.steps)) : [s]));
    const call = flat(steps).find((s) => s.kind === 'link' && s.chip.id === 'api:fx-get-rate');
    expect(call?.kind === 'link' && call.next.map(({ id }) => id)).toEqual(['h:fx-get-rate']);
    expect(story?.stores.map(({ id }) => id)).toContain('st:pricing-db');
  });

  it('gives nothing for what no handler answers', () => {
    expect(handlerStoryOf(model, 'api:nothing-here')).toBeNull();
  });
});

function handlerPlan(): Plan {
  const [missingBranch, noteBranch] = parse(`
- if: the order is missing
  then: [{ return: '404' }]
  else: [{ return: 'sch:order' }]
  does: Choose the response
- if: a note exists
  then: [{ does: Keep it }]
`) as [HandlerStep, HandlerStep];
  return {
    meta: { id: 'handler-view', title: 'Trace the handler' },
    problem: { summary: 'Show recorded work and visible stops.' },
    teams: [],
    systems: [
      { id: 'sys:a', name: 'Orders' },
      { id: 'sys:b', name: 'Records' },
      { id: 'sys:c', name: 'Delivery' },
    ],
    services: [
      { id: 'svc:a', name: 'Orders', kind: 'service', system: 'sys:a' },
      { id: 'svc:b', name: 'Records', kind: 'service', system: 'sys:b' },
      { id: 'svc:c', name: 'Delivery', kind: 'service', system: 'sys:c' },
      { id: 'svc:outside', name: 'Partner', kind: 'external' },
    ],
    stores: [
      { id: 'st:delivery', name: 'Delivery records', kind: 'database', owner: 'svc:c' },
      { id: 'st:db', name: 'Orders database', kind: 'database', owner: 'svc:b' },
      { id: 'st:topic', name: 'Order events', kind: 'topic', owner: 'svc:a' },
    ],
    schemas: [
      { id: 'sch:order', name: 'Order', kind: 'record', store: 'st:db' },
      { id: 'sch:shipment', name: 'Shipment', kind: 'record', store: 'st:delivery' },
    ],
    interfaces: [
      {
        id: 'if:a',
        service: 'svc:a',
        protocol: 'rest',
        endpoints: [{ id: 'api:root', sig: 'POST /orders' }],
      },
      {
        id: 'if:b',
        service: 'svc:b',
        protocol: 'rest',
        endpoints: [
          { id: 'api:child', sig: 'GET /orders' },
          { id: 'api:unread', sig: 'GET /unread' },
        ],
      },
      {
        id: 'if:outside',
        service: 'svc:outside',
        protocol: 'rest',
        endpoints: [{ id: 'api:outside', sig: 'POST /partner' }],
      },
    ],
    messages: [
      {
        id: 'msg:created',
        name: 'Created',
        topic: 'st:topic',
        producer: 'svc:a',
        consumers: ['svc:c'],
      },
    ],
    handlers: [
      {
        id: 'h:root',
        component: 'svc:a',
        on: 'api:root',
        summary: 'Creates an order.',
        sources: [{ repo: 'org/orders', path: 'src/Root.cs', commit: 'abc', lines: [10, 15] }],
        fails: [{ when: 'Order missing', result: '404 not_found' }],
        steps: [
          {
            does: 'Check the input',
            when: 'a cart was supplied',
            async: true,
            sources: [{ url: 'https://code.example/Check.cs#L7-L9' }],
          },
          { call: 'api:child', does: 'Read the order' },
          { publish: 'msg:created' },
          { call: 'api:unread' },
          { call: 'api:outside' },
          { read: 'sch:order', from: 'st:db' },
          { write: 'sch:order', to: 'st:db', does: 'Keep the change' },
          missingBranch,
          { each: 'line', do: [{ does: 'Check the line' }] },
          { parallel: [[{ does: 'Price the order' }], [{ does: 'Check stock' }]] },
          { retry: 'the request', times: 3, do: [{ wait: '1s' }] },
          { retry: 'the request', do: [{ does: 'Try again' }] },
          { try: [{ does: 'Save' }], catch: [{ return: '503' }] },
          { return: 'sch:order', does: 'Answers with the order' },
          { wait: '30s' },
          noteBranch,
        ],
      },
      { id: 'h:child', component: 'svc:b', on: 'api:child', steps: [{ call: 'api:root' }] },
      {
        id: 'h:created',
        component: 'svc:c',
        on: 'msg:created',
        steps: [{ read: 'sch:shipment', from: 'st:delivery' }, { does: 'Prepare delivery' }],
      },
    ],
  };
}
const ids = (chips: readonly { readonly id: string }[]) => chips.map((chip) => chip.id);

describe('handler reading contracts', () => {
  it('keeps source citations, conditions, asynchronous work and declared failures', () => {
    const story = handlerStoryOf(derive(handlerPlan()), 'api:root');
    const root = story!.handlers[0]!;
    expect(root).toMatchObject({
      id: 'h:root',
      on: { id: 'api:root' },
      component: { id: 'svc:a' },
      summary: 'Creates an order.',
      fails: [{ when: 'Order missing', result: '404 not_found' }],
      code: {
        url: 'https://github.com/org/orders/blob/abc/src/Root.cs#L10-L15',
        label: 'Root.cs:10–15',
      },
    });
    expect(root.steps[0]).toMatchObject({
      kind: 'does',
      text: 'Check the input',
      when: 'a cart was supplied',
      async: true,
      code: { url: 'https://code.example/Check.cs#L7-L9', label: 'Check.cs:7–9' },
    });
    expect(new Set(root.steps.map((step) => step.key)).size).toBe(root.steps.length);
  });
  it('opens callees and consumers, terminates cycles, and keeps unread internal calls separate from external boundaries', () => {
    const story = handlerStoryOf(derive(handlerPlan()), 'api:root')!;
    const links = story.handlers[0]!.steps.filter((step) => step.kind === 'link');
    const call = links.find((step) => step.chip.id === 'api:child')!;
    expect(call).toMatchObject({
      verb: 'Calls',
      store: null,
      text: 'Read the order',
      reaches: 'svc:b',
      stop: null,
      unread: false,
    });
    expect(ids(call.next)).toEqual(['h:child']);
    expect(call.next[0]?.steps[0]).toMatchObject({
      kind: 'link',
      next: [],
      stop: 'cycle',
      unread: false,
      chip: { id: 'api:root' },
    });
    const event = links.find((step) => step.chip.id === 'msg:created')!;
    expect(event).toMatchObject({ verb: 'Announces', text: null, stop: null, unread: false });
    expect(ids(event.next)).toEqual(['h:created']);
    expect(ids(story.systems)).toEqual(['sys:b', 'sys:c']);
    expect(ids(story.stores)).toEqual(['st:delivery', 'st:db']);
    expect(ids(story.unread)).toEqual(['api:unread']);
    expect(ids(story.outside)).toEqual(['api:outside']);
    expect(links.find((step) => step.verb === 'Reads')).toMatchObject({
      chip: { id: 'sch:order' },
      store: { id: 'st:db' },
      reaches: 'svc:b',
      next: [],
      stop: null,
      unread: false,
    });
    expect(links.find((step) => step.verb === 'Writes')).toMatchObject({
      chip: { id: 'sch:order' },
      store: { id: 'st:db' },
      text: 'Keep the change',
    });
  });
  it('retains branch conditions, loops, parallel lanes, retry limits and recovery without inventing empty branches', () => {
    const root = handlerStoryOf(derive(handlerPlan()), 'api:root')!.handlers[0]!;
    const blocks = root.steps.filter((step) => step.kind === 'block');
    expect(
      blocks.map((block) => ({
        text: block.text,
        labels: block.branches.map((branch) => branch.label),
      })),
    ).toEqual([
      { text: 'Choose the response', labels: ['If the order is missing', 'Otherwise'] },
      { text: null, labels: ['For each line'] },
      { text: null, labels: ['At the same time (1 of 2)', 'At the same time (2 of 2)'] },
      { text: null, labels: ['Retrying the request, up to 3 times'] },
      { text: null, labels: ['Retrying the request'] },
      { text: null, labels: ['Tries', 'If that fails'] },
      { text: null, labels: ['If a note exists'] },
    ]);
    expect(blocks[0]?.branches[0]?.steps[0]).toMatchObject({
      kind: 'end',
      text: 'Answers with 404',
      chip: null,
    });
    expect(blocks[0]?.branches[1]?.steps[0]).toMatchObject({
      kind: 'end',
      text: 'Answers with',
      chip: { id: 'sch:order' },
    });
    expect(root.steps.filter((step) => step.kind === 'end')).toMatchObject([
      { text: 'Answers with the order', chip: { id: 'sch:order' } },
      { text: 'Waits for 30s', chip: null },
    ]);
    expect(blocks[1]?.branches[0]?.steps[0]).toMatchObject({
      kind: 'does',
      text: 'Check the line',
      when: null,
      async: false,
      code: null,
    });
  });
  it.each([
    [{ url: 'https://code.example/File.cs#L7' }, 'File.cs:7'],
    [{ url: 'https://code.example/File.cs' }, 'File.cs'],
    [{ url: 'https://code.example/' }, 'Code'],
    [{ url: 'https://code.example/File.cs#unknown' }, 'File.cs'],
    [{ url: 'https://code.example/File.cs#L7', label: 'Chosen lines' }, 'Chosen lines'],
    [{ repo: 'org/orders', path: 'src/File.cs', commit: 'abc', lines: [7, 7] }, 'File.cs:7'],
  ] satisfies readonly (readonly [HandlerSource, string])[])(
    'labels a source without guessing missing line ranges (%j)',
    (source, expected) => {
      const value = handlerPlan();
      value.handlers![0]!.sources = [source];
      expect(handlerStoryOf(derive(value), 'api:root')?.handlers[0]?.code?.label).toBe(expected);
    },
  );
  it('stops a deep call chain at the explicit depth boundary', () => {
    const value = handlerPlan();
    value.handlers = [
      { id: 'h:root', on: 'api:root', component: 'svc:a', steps: [{ call: 'api:c1' }] },
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `h:c${String(index + 1)}`,
        on: `api:c${String(index + 1)}`,
        component: 'svc:b',
        steps: [{ call: `api:c${String(index + 2)}` }],
      })),
    ];
    let current = handlerStoryOf(derive(value), 'api:root')!.handlers[0]!;
    for (let depth = 0; depth < 4; depth += 1) {
      const call = current.steps[0]!;
      if (call.kind !== 'link') throw new Error('Expected a call in the fixture.');
      expect(call.stop).toBeNull();
      current = call.next[0]!;
    }
    expect(current.id).toBe('h:c4');
    expect(current.steps[0]).toMatchObject({
      kind: 'link',
      next: [],
      stop: 'depth',
      unread: false,
    });
  });
});
