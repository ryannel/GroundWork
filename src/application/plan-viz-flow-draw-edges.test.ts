import { describe, expect, it as test } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { FlowStep } from '@/application/plan/flow-steps';
import { walker } from '@/application/plan-viz-flow-drawn';
import type { FlowEdge, FlowItem } from '@/application/plan-viz-flow-graph';
import type { Routed } from '@/application/plan-viz-flow-route';
import type { Plan } from '@/domain/plan/plan.generated';

import { type DrawCtx, drawEdges, recordNote, statusNote } from './plan-viz-flow-draw-edges';

const value: Plan = {
  meta: { id: 'drawing', title: 'Show the call' },
  problem: { summary: 'A call and its records.' },
  teams: [],
  services: ['a', 'b', 'c'].map((id) => ({
    id: `svc:${id}`,
    name: id.toUpperCase(),
    kind: 'service',
  })),
  schemas: [
    { id: 'sch:order', name: 'Order', kind: 'record', fields: [{ name: 'id', type: 'string' }] },
    { id: 'sch:cart', name: 'Cart', kind: 'record' },
  ],
  flows: [
    {
      id: 'flow:f',
      name: 'Read',
      steps: [
        { id: 'flow:f#one', from: 'svc:a', to: 'svc:b', via: 'api:read', action: 'Read the order' },
        { id: 'flow:f#two', from: 'svc:a', to: 'svc:b', via: 'api:read', action: 'Read the cart' },
      ],
    },
  ],
  changes: [
    {
      id: 'chg:draw',
      title: 'Change the call',
      ops: [
        { deprecate: 'flow:f#one' },
        {
          add: 'step',
          into: 'flow:f',
          value: {
            id: 'flow:f#new',
            from: 'svc:a',
            to: 'svc:c',
            via: 'api:new',
            action: 'Read the new data',
          },
        },
      ],
    },
  ],
};
const model = derive(value);
const one = model.asIs.steps[0]!;
const two = model.asIs.steps[1]!;
function item(s: FlowStep = one, extra: Partial<FlowItem> = {}): FlowItem {
  return { s, i: 0, text: 'Read order', ...extra };
}
function route(items: readonly FlowItem[] = [item()], extra: Partial<FlowEdge> = {}): Routed {
  const e: FlowEdge = {
    key: 'call',
    kind: 'api',
    from: 'svc:a',
    to: 'svc:b',
    via: 'api:read',
    items,
    all: items,
    lines: items.map((it) => ({ t: it.text, first: true, it })),
    lw: 100,
    lh: 40,
    back: false,
    ...extra,
  };
  return {
    e,
    pts: [
      [0, 10],
      [120, 10],
    ],
    r: { x: 20, y: 20, w: 100, h: 40 },
  };
}
const context = (extra: Partial<DrawCtx> = {}): DrawCtx => ({
  model,
  mode: 'diff',
  walk: walker(new Set([0])),
  markers: { 'flow:f#one': '◇' },
  ...extra,
});

describe('flow arrow and label data', () => {
  test('names each distinct record once, with writes before reads, resolving child fields to their schema', () => {
    expect(
      recordNote(model, {
        ...one,
        writes: ['sch:order#id', 'sch:order'],
        reads: ['sch:cart', 'sch:cart', 'sch:missing'],
      }),
    ).toBe(' · writes Order · reads Cart, sch:missing');
    expect(recordNote(model, one)).toBe('');
  });
  test('transports accessible arrow descriptions and opens a modelled call while preserving the routed geometry', () => {
    const routed = route([item(), item(two, { i: 1, text: 'Read cart' })]);
    const result = drawEdges(context(), [routed]);
    expect(result.edges[0]).toMatchObject({
      key: 'call',
      kind: 'api',
      from: 'svc:a',
      to: 'svc:b',
      walk: 'current',
      implicit: false,
      state: '',
      steps: [0, 1],
      ref: 'api:read',
      vias: ['api:read'],
      title: '1. Read order\n2. Read cart',
      aria: 'A → B: 1. Read order; 2. Read cart',
      pts: routed.pts,
    });
    expect(result.edges[0]?.d).toMatch(/^M/u);
    expect(result.edges[0]?.d).not.toContain('NaN');
    expect(result.labels[0]).toMatchObject({
      key: 'call',
      kind: 'api',
      from: 'svc:a',
      to: 'svc:b',
      steps: [0, 1],
      x: 20,
      y: 20,
      w: 100,
      h: 40,
    });
    expect(result.labels[0]?.rows[0]).toMatchObject({
      text: 'Read order',
      first: true,
      implicit: false,
      walk: 'current',
      state: 'deprecated',
      number: '1',
      lettered: false,
      description: 'Step 1: Read the order · Deprecated · still works',
      step: 0,
      steps: [0],
      ref: 'flow:f#one',
      mark: '◇',
    });
    expect(result.labels[0]?.rows[1]).toMatchObject({
      number: '2',
      walk: 'tocome',
      state: '',
      step: 1,
      mark: null,
    });
    const ys = result.labels[0]!.rows.map((row) => row.y);
    expect(ys[0]).toBeGreaterThan(20);
    expect(ys[1]).toBeGreaterThan(ys[0]!);
    expect(ys[1]).toBeLessThan(60);
  });
  test('keeps continuation lines unnumbered and unmarked and omits a label only when its rectangle is absent', () => {
    const it = item();
    const routed = route([it], {
      lines: [
        { t: 'first', first: true, it },
        { t: 'continued', first: false, it },
      ],
    });
    const result = drawEdges(context(), [routed]);
    expect(result.labels[0]?.steps).toEqual([0]);
    expect(result.labels[0]?.rows[1]).toMatchObject({
      text: 'continued',
      first: false,
      number: null,
      mark: null,
    });
    expect(drawEdges(context(), [{ ...routed, r: null }]).labels).toEqual([]);
    expect(drawEdges(context(), [{ ...routed, r: null }]).edges).toHaveLength(1);
  });
  test('does not colour today as a change or describe a live step as deprecated', () => {
    const ctx = context({ mode: 'asIs' });
    expect(statusNote(ctx, one)).toBe('');
    expect(statusNote(context(), one)).toBe('Deprecated · still works');
    expect(statusNote(context(), two)).toBe('');
    expect(drawEdges(ctx, [route()]).labels[0]?.rows[0]).toMatchObject({
      state: '',
      description: 'Step 1: Read the order',
    });
  });
  test('opens internal and implicit accesses on their step, keeps implicit arrows uncoloured, and omits internal vias', () => {
    for (const via of ['', 'internal']) {
      const result = drawEdges(context(), [route([item({ ...one, via })])]);
      expect(result.edges[0]).toMatchObject({ ref: 'flow:f#one', vias: [] });
    }
    const result = drawEdges(context(), [route([item(one, { implicit: true })])]);
    expect(result.edges[0]).toMatchObject({ implicit: true, state: '', ref: 'flow:f#one' });
    expect(result.labels[0]?.rows[0]).toMatchObject({ implicit: true, number: null, state: '' });
  });
  test('gives gateway fan-out a lettered number and no independent change mark', () => {
    const result = drawEdges(context(), [route([item(one, { fan: true, letter: 'a' })])]);
    expect(result.edges[0]?.state).toBe('');
    expect(result.labels[0]?.rows[0]).toMatchObject({
      number: '1a',
      lettered: true,
      state: '',
      mark: null,
    });
  });
  test('opens folded record access on its destination and follows any current member', () => {
    const members = [item(), item(two, { i: 1 })];
    const grouped = item(one, { text: 'Read shared data', members });
    const ctx = context({
      walk: walker(new Set([1])),
      markers: { 'flow:f#one': '', 'flow:f#two': '◇' },
    });
    const result = drawEdges(ctx, [route([grouped], { to: 'st:db' })]);
    expect(result.labels[0]?.steps).toEqual([0, 1]);
    expect(result.labels[0]?.rows[0]).toMatchObject({
      walk: 'current',
      description: 'Read shared data during Read the order and Read the cart',
      step: null,
      steps: [0, 1],
      ref: 'st:db',
      mark: '◇',
    });
  });
  test('distinguishes removed and newly connected arrows and retains a live existing arrow beside a removed item', () => {
    const removed = item({ ...one, $removed: true });
    expect(drawEdges(context(), [route([removed])]).edges[0]?.state).toBe('removed');
    expect(drawEdges(context(), [route([removed, item(two, { i: 1 })])]).edges[0]?.state).toBe('');
    const added = model.toBe.steps.find((step) => step.id === 'flow:f#new')!;
    expect(drawEdges(context(), [route([item(added)])]).edges[0]?.state).toBe('added');
    expect(drawEdges(context({ mode: 'asIs' }), [route([removed])]).edges[0]?.state).toBe('');
    expect(drawEdges(context(), [route([])]).edges[0]).toMatchObject({
      ref: 'svc:a',
      vias: [],
      steps: [],
      title: '',
      implicit: true,
      state: '',
    });
  });
});
