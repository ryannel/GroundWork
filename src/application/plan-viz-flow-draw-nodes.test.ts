import { describe, expect, it } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { DrawCtx } from '@/application/plan-viz-flow-draw-edges';
import { walker } from '@/application/plan-viz-flow-drawn';
import type { FlowNodeSpec } from '@/application/plan-viz-flow-graph';
import type { Plan } from '@/domain/plan/plan.generated';

import { drawNodes, touchedBy } from './plan-viz-flow-draw-nodes';

const value: Plan = {
  meta: { id: 'cards', title: 'Draw node facts' },
  problem: { summary: 'Keep the card and inspector consistent.' },
  teams: [{ id: 'team:a', name: 'A' }],
  services: [
    { id: 'svc:a', name: 'A', kind: 'service', team: 'team:a' },
    { id: 'svc:b', name: 'B', kind: 'ui' },
    { id: 'svc:job', name: 'Job', kind: 'job' },
    { id: 'svc:external', name: 'Partner', kind: 'external' },
  ],
  stores: [
    { id: 'st:db', name: 'Orders', kind: 'database' },
    { id: 'st:cache', name: 'Cache', kind: 'cache' },
    { id: 'st:topic', name: 'Events', kind: 'topic' },
  ],
  interfaces: [
    {
      id: 'if:a',
      service: 'svc:a',
      protocol: 'rest',
      endpoints: [{ id: 'api:read', sig: 'GET /records', summary: '**Read** [[svc:b]]' }],
    },
  ],
  schemas: [
    {
      id: 'sch:order',
      name: 'Order',
      kind: 'record',
      store: 'st:db',
      fields: [{ name: 'id', type: 'string' }],
    },
    { id: 'sch:unplaced', name: 'Unknown', kind: 'dto' },
  ],
  messages: [{ id: 'msg:changed', name: 'Changed', topic: 'st:topic' }],
  flows: [
    {
      id: 'flow:work',
      name: 'Work',
      steps: [
        {
          id: 'flow:work#old',
          from: 'svc:a',
          to: 'svc:a',
          via: 'internal',
          action: '**Update** [[svc:b]]',
          writes: ['sch:order#id'],
        },
        { id: 'flow:work#keep', from: 'svc:a', to: 'svc:a', via: 'internal', action: 'Compute' },
      ],
    },
  ],
  changes: [
    {
      id: 'chg:cards',
      title: 'Change cards',
      ops: [
        { modify: 'svc:a', set: { name: 'A revised' } },
        { deprecate: 'flow:work#old' },
        { add: 'service', value: { id: 'svc:new', name: 'New app', kind: 'ui' } },
        { add: 'endpoint', into: 'if:a', value: { id: 'api:new', sig: 'POST /records' } },
        { add: 'message', value: { id: 'msg:new', name: 'Added', topic: 'st:topic' } },
      ],
    },
  ],
};
const model = derive(value);
const context = (mode: DrawCtx['mode'] = 'diff'): DrawCtx => ({
  model,
  mode,
  walk: walker(new Set([0])),
  markers: { 'svc:a': '◇', 'flow:work#old': '◇' },
});
const node = (id: string, extra: Partial<FlowNodeSpec> = {}): FlowNodeSpec => ({
  id,
  kind: 'service',
  endpoints: [],
  selfs: [],
  events: [],
  sats: [],
  sat: false,
  x: 10,
  y: 20,
  w: 300,
  h: 200,
  fullH: 200,
  ph: 30,
  nameLines: ['Events'],
  ...extra,
});
const filters = {
  touched: new Set(['svc:a']),
  touchSteps: new Map([['svc:a', [0, 1]]]),
  lens: 'team:b',
};

describe('flow node drawing data', () => {
  it('retains placement, ownership, plan state, lens state and inspector markers', () => {
    const result = drawNodes(
      context(),
      [node('svc:a'), node('svc:new'), node('svc:missing')],
      filters,
    );
    expect(result[0]).toMatchObject({
      id: 'svc:a',
      kind: 'service',
      name: 'A revised',
      x: 10,
      y: 20,
      w: 300,
      h: 200,
      state: 'modified',
      touched: true,
      touchSteps: [0, 1],
      lensOff: true,
      team: 1,
      mark: '◇',
    });
    expect(result[1]).toMatchObject({
      state: 'added',
      touched: false,
      touchSteps: [],
      team: 8,
      mark: null,
    });
    expect(result[2]?.body).toEqual({
      kind: 'service',
      what: 'service',
      glyph: '▣',
      word: 'SERVICE',
      endpoints: [],
      selfs: [],
    });
    const options: { readonly lens?: string } = {};
    expect(
      drawNodes(context('asIs'), [node('svc:a')], { ...filters, lens: options.lens })[0],
    ).toMatchObject({ state: '', lensOff: false });
    expect(drawNodes(context(), [node('svc:a')], { ...filters, lens: 'team:a' })[0]?.lensOff).toBe(
      false,
    );
  });
  it('uses component glyphs and store vocabulary without guessing an unknown kind', () => {
    expect(
      drawNodes(context(), [node('svc:b'), node('svc:job'), node('svc:external')], filters).map(
        (n) => n.body,
      ),
    ).toEqual([
      { kind: 'service', what: 'ui', glyph: '◧', word: 'UI', endpoints: [], selfs: [] },
      { kind: 'service', what: 'job', glyph: '⏱', word: 'JOB', endpoints: [], selfs: [] },
      { kind: 'service', what: 'external', glyph: '◇', word: 'EXTERNAL', endpoints: [], selfs: [] },
    ]);
    expect(
      drawNodes(
        context(),
        ['st:db', 'st:cache'].map((id) => node(id, { kind: 'store' })),
        filters,
      ).map((n) => n.body),
    ).toEqual([
      { kind: 'store', word: 'DATABASE', name: 'Orders' },
      { kind: 'store', word: 'CACHE', name: 'Cache' },
    ]);
  });
  it('draws endpoint rows and internal steps with readable summaries, geometry and walk states', () => {
    const spec = node('svc:a', {
      endpoints: [
        { via: 'api:read', steps: [0] },
        { via: 'api:new', steps: [1] },
      ],
      selfs: [
        { i: 0, s: model.asIs.steps[0]!, lines: ['Update', 'B'] },
        { i: 1, s: model.asIs.steps[1]!, lines: ['Compute'] },
      ],
    });
    const body = drawNodes(context(), [spec], filters)[0]!.body;
    expect(body).toMatchObject({
      endpoints: [
        {
          via: 'api:read',
          protocol: 'REST',
          tagW: 42.4,
          text: 'GET /records',
          title: 'REST call: GET /records — Read B',
          aria: 'REST call: GET /records',
          added: false,
          cy: 57,
        },
        {
          via: 'api:new',
          protocol: 'REST',
          tagW: 42.4,
          text: 'POST /records',
          title: 'REST call: POST /records',
          aria: 'REST call: POST /records',
          added: true,
          cy: 79,
        },
      ],
      selfs: [
        {
          step: 0,
          id: 'flow:work#old',
          lines: ['Update', 'B'],
          cy: 101,
          walk: 'current',
          state: 'deprecated',
          title: 'Step 1 (inside A revised): Update B · writes Order · Deprecated · still works',
          aria: 'Step 1: **Update** [[svc:b]] · Deprecated · still works',
          mark: '◇',
        },
        {
          step: 1,
          id: 'flow:work#keep',
          lines: ['Compute'],
          cy: 137,
          walk: 'tocome',
          state: '',
          title: 'Step 2 (inside A revised): Compute',
          aria: 'Step 2: Compute',
          mark: null,
        },
      ],
    });
    expect(drawNodes(context('asIs'), [spec], filters)[0]?.body).toMatchObject({
      endpoints: [{ added: false }, { added: false }],
      selfs: [{ state: '' }, { state: '' }],
    });
  });
  it('keeps topic event labels and positions, and only marks additions in the planned state', () => {
    const spec = node('st:topic', { kind: 'topic', events: ['msg:changed', 'msg:new'] });
    expect(drawNodes(context(), [spec], filters)[0]?.body).toMatchObject({
      kind: 'topic',
      ph: 30,
      nameLines: ['Events'],
      events: [
        { id: 'msg:changed', text: 'Changed', title: 'Changed', added: false, y: 48, textX: 156 },
        { id: 'msg:new', text: 'Added', title: 'Added', added: true, y: 64, textX: 156 },
      ],
    });
    expect(drawNodes(context('asIs'), [spec], filters)[0]?.body).toMatchObject({
      events: [{ added: false }, { added: false }],
    });
  });
  it('collects only evidenced record stores alongside each step’s explicit ends', () => {
    expect(
      touchedBy(model, [
        undefined,
        {
          ...model.asIs.steps[0]!,
          from: 'svc:a',
          to: 'svc:b',
          reads: ['sch:order#id', 'sch:unplaced', 'missing'],
          writes: ['sch:order'],
        },
      ]),
    ).toEqual(new Set(['svc:a', 'svc:b', 'st:db']));
    expect(touchedBy(model, [])).toEqual(new Set());
  });
});
