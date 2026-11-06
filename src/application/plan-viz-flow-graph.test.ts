import { describe, expect, it as test } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { derive } from '@/application/plan/derive';
import { flowSteps } from '@/application/plan/flow-steps';
import type { Plan, Step } from '@/domain/plan/plan.generated';

import { actionOf, buildGraph, stateNote, stepState, storeOf } from './plan-viz-flow-graph';

const step = (name: string, extra: Partial<Step> = {}): Step => ({
  id: `flow:read#${name}`,
  from: 'svc:a',
  to: 'svc:b',
  via: 'api:get',
  action: 'Read the record',
  ...extra,
});
function plan(): Plan {
  return {
    meta: { id: 'graph', title: 'Trace the records' },
    problem: { summary: 'Keep every call and recorded store use.' },
    teams: [],
    services: ['a', 'b', 'c'].map((id) => ({ id: `svc:${id}`, name: id, kind: 'service' })),
    stores: [
      { id: 'st:db', name: 'Orders', kind: 'database' },
      { id: 'st:cache', name: 'Prices', kind: 'cache' },
      { id: 'st:topic', name: 'Changed', kind: 'topic' },
      { id: 'st:queue', name: 'Queued', kind: 'queue' },
      { id: 'st:unused', name: 'Unused', kind: 'database' },
    ],
    schemas: [
      {
        id: 'sch:order',
        name: 'Order',
        kind: 'record',
        store: 'st:db',
        fields: [{ name: 'id', type: 'string' }],
      },
      { id: 'sch:cart', name: 'Cart', kind: 'record', store: 'st:db' },
      { id: 'sch:price', name: 'Price', kind: 'record', store: 'st:cache' },
      { id: 'sch:unplaced', name: 'Unplaced', kind: 'dto' },
    ],
    flows: [
      {
        id: 'flow:read',
        name: 'Read',
        steps: [
          step('one', {
            writes: ['sch:order#id', 'sch:order'],
            reads: ['sch:cart', 'sch:price', 'sch:unplaced', 'sch:missing'],
          }),
          step('two', { writes: ['sch:cart'] }),
          step('self', {
            from: 'svc:b',
            to: 'svc:b',
            via: 'internal',
            action: 'Refresh local state',
          }),
          step('publish', { from: 'svc:b', to: 'st:topic', via: 'msg:changed' }),
          step('consume', {
            from: 'st:topic',
            to: 'svc:c',
            via: 'msg:changed',
            writes: ['sch:order'],
          }),
          step('queue', { from: 'svc:c', to: 'st:queue', via: 'msg:queued' }),
          step('unmapped', { from: 'svc:unmapped', to: 'svc:a', via: '' }),
          step('removed', { from: 'svc:b', to: 'svc:c', via: 'api:old' }),
        ],
      },
    ],
    changes: [
      {
        id: 'chg:trace',
        title: 'Change the trace',
        ops: [
          { modify: 'flow:read#two', set: { action: 'Read the new shape' } },
          { deprecate: 'flow:read#self' },
          { remove: 'flow:read#removed' },
          {
            add: 'step',
            into: 'flow:read',
            value: step('new', { from: 'svc:a', to: 'svc:c', via: 'api:new' }),
          },
        ],
      },
    ],
  };
}
const model = derive(plan());

describe('a flow graph before layout', () => {
  test('keeps each called endpoint once with every contributing step and leaves geometry to layout', () => {
    const graph = buildGraph(model, 'flow:read', { mode: 'asIs' });
    expect(graph?.nodes.get('svc:b')).toMatchObject({
      id: 'svc:b',
      kind: 'service',
      endpoints: [{ via: 'api:get', steps: [0, 1] }],
      sat: false,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      fullH: 0,
      ph: 0,
      nameLines: [],
    });
    const calls = graph?.edges.get('svc:a>svc:b|api:get');
    expect(calls).toMatchObject({
      key: 'svc:a>svc:b|api:get',
      from: 'svc:a',
      to: 'svc:b',
      kind: 'api',
      via: 'api:get',
      all: [],
      lines: [],
      lw: 0,
      lh: 0,
      back: false,
    });
    expect(calls?.items.map(({ i, s, text }) => [i, s.id, text])).toEqual([
      [0, 'flow:read#one', 'Read the record'],
      [1, 'flow:read#two', 'Read the record'],
    ]);
    expect(graph?.nodes.has('st:unused')).toBe(false);
  });
  test('keeps event direction, treats topics and queues as pipes, and deduplicates their event labels', () => {
    const graph = buildGraph(model, 'flow:read', { mode: 'asIs' });
    expect(graph?.nodes.get('st:topic')).toMatchObject({
      kind: 'topic',
      events: ['msg:changed'],
      sat: false,
    });
    expect(graph?.nodes.get('st:queue')).toMatchObject({
      kind: 'topic',
      events: ['msg:queued'],
      sat: false,
    });
    expect(graph?.edges.get('svc:b>st:topic|')).toMatchObject({
      kind: 'msg',
      via: null,
      from: 'svc:b',
      to: 'st:topic',
    });
    expect(graph?.edges.get('st:topic>svc:c|')).toMatchObject({
      kind: 'msg',
      from: 'st:topic',
      to: 'svc:c',
    });
    expect(graph?.nodes.get('svc:unmapped')?.kind).toBe('service');
    expect(graph?.edges.get('svc:unmapped>svc:a|')?.kind).toBe('data');
  });
  test('attributes record access to the API provider or event consumer, with writes taking precedence in the same store', () => {
    const graph = buildGraph(model, 'flow:read', { mode: 'asIs' });
    expect(graph?.nodes.get('st:db')).toMatchObject({ kind: 'store', sat: false });
    expect(
      graph?.edges
        .get('svc:b>st:db|')
        ?.items.map(({ text, refs, implicit, i }) => ({ text, refs, implicit, i })),
    ).toEqual([
      { text: 'writes Order', refs: ['sch:order#id', 'sch:order'], implicit: true, i: 0 },
      { text: 'writes Cart', refs: ['sch:cart'], implicit: true, i: 1 },
    ]);
    expect(graph?.edges.get('svc:c>st:db|')?.items[0]).toMatchObject({
      text: 'writes Order',
      implicit: true,
      i: 4,
    });
    expect(graph?.sats.get('st:cache')?.items[0]).toMatchObject({
      text: 'reads Price',
      implicit: true,
      refs: ['sch:price'],
    });
    expect(graph?.nodes.has('st:missing')).toBe(false);
    expect(storeOf(model, 'sch:order#id')).toBe('st:db');
    expect(storeOf(model, 'sch:unplaced')).toBeNull();
    expect(storeOf(model, 'sch:missing')).toBeNull();
    expect(storeOf(model, 'svc:a')).toBeNull();
  });
  test('hangs a store used by one service under that service and keeps shared stores as independent nodes', () => {
    const graph = buildGraph(model, 'flow:read', { mode: 'asIs' });
    expect([...graph!.sats.keys()]).toEqual(['st:cache']);
    expect(graph?.nodes.get('st:cache')?.sat).toBe(true);
    expect(graph?.edges.has('svc:b>st:cache|')).toBe(false);
    expect(
      graph?.nodes.get('svc:b')?.sats.map(({ id, r, e }) => ({ id, r, actor: e.from })),
    ).toEqual([{ id: 'st:cache', r: { x: 0, y: 0, w: 0, h: 0 }, actor: 'svc:b' }]);
    expect(graph?.nodes.get('st:db')?.sat).toBe(false);
  });
  test('keeps self work inside its card with a visible deprecation note only in planned modes', () => {
    const current = buildGraph(model, 'flow:read', { mode: 'asIs' })?.nodes.get('svc:b')?.selfs;
    expect(current?.map(({ i, s, lines }) => [i, s.id, lines])).toEqual([
      [2, 'flow:read#self', ['Refresh local state']],
    ]);
    const planned = buildGraph(model, 'flow:read', { mode: 'diff' })?.nodes.get('svc:b')?.selfs;
    expect(planned?.[0]?.lines).toEqual(['Refresh local state', 'Deprecated · still works']);
  });
  test('respects an explicit step selection and keeps missing or empty flows distinct', () => {
    const graph = buildGraph(model, 'flow:read', { mode: 'asIs', only: new Set([0]) });
    expect([...graph!.nodes.keys()]).toEqual(['svc:a', 'svc:b', 'st:db', 'st:cache']);
    expect([...graph!.edges.keys()]).toEqual(['svc:a>svc:b|api:get']);
    expect([...graph!.sats.keys()]).toEqual(['st:db', 'st:cache']);
    expect(buildGraph(model, 'flow:read', { mode: 'asIs', only: new Set() })).toEqual({
      nodes: new Map(),
      edges: new Map(),
      sats: new Map(),
    });
    expect(buildGraph(model, 'flow:missing', { mode: 'asIs' })).toBeNull();
  });
  test('keeps changed, removed, added and deprecated step states distinct, without colouring today', () => {
    const steps = flowSteps(model, 'flow:read', 'diff');
    expect(steps.map((s) => [s.id, stepState(model, 'diff', s)])).toEqual([
      ['flow:read#one', ''],
      ['flow:read#two', 'modified'],
      ['flow:read#self', 'deprecated'],
      ['flow:read#publish', 'added'],
      ['flow:read#consume', 'added'],
      ['flow:read#queue', 'added'],
      ['flow:read#unmapped', 'added'],
      ['flow:read#removed', 'removed'],
      ['flow:read#new', 'added'],
    ]);
    expect(steps.every((s) => stepState(model, 'asIs', s) === '')).toBe(true);
    expect(stateNote('added')).toBe('');
    expect(actionOf({ ...steps[0]!, action: '' })).toBe('flow:read#one');
  });
  test('letters GraphQL fan-out once for each distinct provider, retaining the original step identity', () => {
    const graphModel = derive(shop());
    const graph = buildGraph(graphModel, 'flow:browse', { mode: 'toBe' });
    const fans = [...graph!.edges.values()].flatMap((edge) =>
      edge.items
        .filter((it) => it.fan === true)
        .map((it) => ({ to: edge.to, i: it.i, id: it.s.id, letter: it.letter, text: it.text })),
    );
    expect(fans.length).toBeGreaterThan(0);
    expect(new Set(fans.map((fan) => fan.to)).size).toBe(fans.length);
    expect(fans.map((fan) => fan.letter)).toEqual(
      fans.map((_, index) => String.fromCodePoint(97 + index)),
    );
    expect(
      fans.every(
        (fan) =>
          fan.id === 'flow:browse#open' &&
          fan.i === 0 &&
          fan.text !== '' &&
          !fan.text.endsWith(' subgraph'),
      ),
    ).toBe(true);
  });
});
