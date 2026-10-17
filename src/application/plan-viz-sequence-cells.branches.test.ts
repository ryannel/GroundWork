import { describe, expect, it } from 'vitest';

import { modelOf } from '@/../test/plan-kit';
import { acme } from '@/../test/workspace-kit';
import type { FlowStep } from '@/application/plan/flow-steps';
import { type Ctx, cellOf, type SeqStep } from '@/application/plan-viz-sequence-cells';
import type { Plan } from '@/domain/plan/plan.generated';

const today = acme().today.plan;
const plan: Plan = {
  ...today,
  changes: [
    {
      id: 'chg:quote',
      title: 'Quote an order first',
      ops: [
        {
          add: 'endpoint',
          into: 'if:orders-rest',
          value: { id: 'api:orders-quote', sig: 'POST /orders/quote' },
        },
        { modify: 'flow:place-order#create', set: { action: 'Create the order once quoted' } },
        { deprecate: 'flow:place-order#charge' },
      ],
    },
  ],
};
const model = modelOf(plan);

const PARTS = ['svc:shop-bff', 'svc:order-api', 'st:orders-db', 'st:order-events', 'svc:payments'];

const ctxOf = (edit: Partial<Ctx> = {}): Ctx => ({
  model,
  mode: 'toBe',
  cur: new Set(),
  off: 1,
  cols: 6,
  participants: PARTS,
  markers: {},
  markerTitle: '',
  pills: false,
  ...edit,
});

const where = { at: 4, gut: [] };

const stepOf = (edit: Partial<FlowStep> & Pick<FlowStep, 'from' | 'to' | 'via'>): FlowStep => ({
  id: 'flow:place-order#create',
  action: 'Create the order',
  $type: 'step',
  $path: [],
  ...edit,
});

function stepCell(
  ctx: Ctx,
  s: FlowStep,
  extra: { readonly i?: number; readonly see?: string } = {},
): SeqStep {
  const i = extra.i ?? 1;
  const cell = cellOf(
    ctx,
    { type: 'step', i, row: { kind: 'step', i, step: s }, see: extra.see ?? null },
    where,
  );
  if (cell.kind !== 'step') throw new Error('not a step');
  return cell;
}

describe('cellOf for frames and links', () => {
  const ctx = ctxOf();

  it('passes a group tab through and puts an else in plain words', () => {
    expect(cellOf(ctx, { type: 'group', tab: 'loop' }, where)).toEqual({
      kind: 'group',
      ...where,
      tab: 'loop',
    });
    expect(cellOf(ctx, { type: 'else', text: 'when [[svc:payments]] says *no*' }, where)).toEqual({
      kind: 'else',
      ...where,
      text: `when ${model.label('svc:payments')} says no`,
    });
  });

  it('starts a trigger from the first lifeline after the person', () => {
    expect(cellOf(ctx, { type: 'trigger', text: 'A customer pays' }, where)).toEqual({
      kind: 'trigger',
      ...where,
      text: 'A customer pays',
      place: { start: 4, span: 6 },
    });
  });

  it('draws the entry from the person to the first participant it reaches', () => {
    const cell = cellOf(ctx, { type: 'enter', to: 'svc:order-api', label: 'Pay' }, where);
    expect(cell).toEqual({
      kind: 'link',
      ...where,
      role: 'enter',
      arrow: {
        kind: 'enter',
        label: 'Pay',
        ref: '',
        title: 'Pay',
        place: { start: 2, span: 4 },
        rev: false,
        toLeft: false,
      },
    });
  });

  it('draws a reply back to the left, its label overhanging when the columns run out', () => {
    const cell = cellOf(
      ctx,
      {
        type: 'reply',
        from: 'svc:payments',
        to: 'svc:order-api',
        label: 'Taken',
        ref: 'sch:order',
      },
      where,
    );
    expect(cell).toEqual({
      kind: 'link',
      ...where,
      role: 'reply',
      arrow: {
        kind: 'reply',
        label: 'Taken',
        ref: 'sch:order',
        title: 'What the call answers: Taken',
        place: { start: 6, span: 6 },
        rev: true,
        toLeft: true,
      },
    });
  });
});

describe('cellOf for a step', () => {
  it('draws a call as an arrow with its signature, and opens the endpoint', () => {
    const cell = stepCell(
      ctxOf(),
      stepOf({ from: 'svc:shop-bff', to: 'svc:order-api', via: 'api:orders-create' }),
    );
    expect(cell.arrow).toEqual({
      kind: 'api',
      label: 'POST /orders',
      ref: 'api:orders-create',
      title: model.label('api:orders-create'),
      place: { start: 4, span: 2 },
      rev: false,
      toLeft: false,
    });
    expect(cell.self).toBeNull();
    expect(cell).toMatchObject({ index: 1, action: 'Create the order', logic: '', see: null });
  });

  it('draws an unnamed step to a store as a write or a read, and one between services as a plain arrow', () => {
    const write = stepCell(
      ctxOf(),
      stepOf({ from: 'svc:order-api', to: 'st:orders-db', via: '', writes: ['sch:order'] }),
    );
    expect(write.arrow).toMatchObject({ kind: 'data', label: 'write', ref: '', title: 'write' });
    const read = stepCell(
      ctxOf(),
      stepOf({ from: 'st:orders-db', to: 'svc:order-api', via: 'internal' }),
    );
    expect(read.arrow).toMatchObject({ kind: 'data', label: 'read', rev: true });
    const plain = stepCell(ctxOf(), stepOf({ from: 'svc:shop-bff', to: 'svc:payments', via: '' }));
    expect(plain.arrow).toMatchObject({ kind: 'data', label: '', title: '' });
  });

  it('draws a step inside one service as a box with the stores it writes, else those it reads', () => {
    const writes = stepCell(
      ctxOf(),
      stepOf({
        from: 'svc:order-api',
        to: 'svc:order-api',
        via: 'internal',
        writes: ['sch:order#status'],
        reads: ['sch:order#status', 'sch:product'],
      }),
    );
    expect(writes.arrow).toBeNull();
    expect(writes.self).toEqual({
      place: { start: 6, span: 6 },
      left: false,
      stores: [
        {
          id: 'st:orders-db',
          label: model.label('st:orders-db'),
          title: `Writes to ${model.label('st:orders-db')}`,
        },
      ],
    });
    expect(writes.recs.map((r) => [r.id, r.verb, r.title])).toEqual([
      [
        'sch:order#status',
        'w',
        `Writes ${model.label('sch:order')} in ${model.label('st:orders-db')}`,
      ],
      [
        'sch:product',
        'r',
        `Reads ${model.label('sch:product')} in ${model.label('st:products-db')}`,
      ],
    ]);
    const reads = stepCell(
      ctxOf(),
      stepOf({
        from: 'svc:payments',
        to: 'svc:payments',
        via: 'internal',
        reads: ['sch:order', 'sch:order-placed-v1'],
      }),
    );
    expect(reads.self).toMatchObject({
      place: { start: 1, span: 11 },
      left: true,
      stores: [{ id: 'st:orders-db', title: `Reads from ${model.label('st:orders-db')}` }],
    });
    expect(reads.recs.map((r) => r.title)).toContain(`Reads ${model.label('sch:order-placed-v1')}`);
  });

  it('keeps a box right of its lifeline when there are only two columns', () => {
    const cell = stepCell(
      ctxOf({ cols: 2, off: 0 }),
      stepOf({ from: 'svc:order-api', to: 'svc:order-api', via: '' }),
    );
    expect(cell.self).toEqual({ place: { start: 4, span: 6 }, left: false, stores: [] });
  });

  it('says how a step changed, with a pill only when asked', () => {
    const create = stepOf({ from: 'svc:shop-bff', to: 'svc:order-api', via: 'api:orders-create' });
    expect(stepCell(ctxOf(), create)).toMatchObject({ status: 'modified', pill: null });
    expect(stepCell(ctxOf({ pills: true }), create).pill).toEqual({
      tone: 'mod',
      text: 'works differently',
    });
    expect(stepCell(ctxOf({ pills: true, mode: 'asIs' }), create)).toMatchObject({
      status: 'existing',
      pill: null,
    });
    const charge = stepOf({
      id: 'flow:place-order#charge',
      from: 'svc:order-api',
      to: 'svc:payments',
      via: 'api:payments-charge',
    });
    expect(stepCell(ctxOf({ pills: true }), charge).pill).toEqual({
      tone: 'dep',
      text: 'Deprecated · still works',
    });
    const gone = stepCell(ctxOf({ mode: 'asIs', pills: true }), { ...charge, $removed: true });
    expect(gone).toMatchObject({ status: 'removed', pill: { tone: 'rem', text: 'removed' } });
    const other = stepCell(ctxOf(), { ...charge, id: 'flow:nowhere#x' });
    expect(other.status).toBe('existing');
  });

  it('marks a step that goes over an endpoint the plan adds as new, but not in today', () => {
    const quote = stepOf({ from: 'svc:shop-bff', to: 'svc:order-api', via: 'api:orders-quote' });
    expect(stepCell(ctxOf(), quote).isNew).toBe(true);
    expect(stepCell(ctxOf({ mode: 'asIs' }), quote).isNew).toBe(false);
    const old = stepOf({ from: 'svc:shop-bff', to: 'svc:order-api', via: 'api:orders-create' });
    expect(stepCell(ctxOf(), old).isNew).toBe(false);
    const inside = stepOf({ from: 'svc:order-api', to: 'svc:order-api', via: 'internal' });
    expect(stepCell(ctxOf(), inside).isNew).toBe(false);
  });

  it('carries the screen, the marker, the logic and how far the walk has got', () => {
    const s = stepOf({
      from: 'svc:shop-bff',
      to: 'svc:order-api',
      via: 'api:orders-create',
      logic: 'Only when the basket is full.',
    });
    const ctx = ctxOf({ cur: new Set([3]), markers: { 'flow:place-order#create': 'A' } });
    const cell = stepCell(ctx, s, { i: 1, see: 'scr:basket#total' });
    expect(cell).toMatchObject({
      walk: 'walked',
      marker: 'A',
      logic: 'Only when the basket is full.',
      see: { ref: 'scr:basket', label: 'Basket' },
    });
    expect(stepCell(ctx, s, { i: 3 }).walk).toBe('current');
    expect(stepCell(ctx, s, { i: 5 })).toMatchObject({ walk: '', marker: 'A' });
    expect(stepCell(ctxOf(), { ...s, id: 'flow:x#y' }).marker).toBeNull();
  });
});
