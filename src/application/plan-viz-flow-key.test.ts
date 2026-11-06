import { describe, expect, it } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Plan, Step } from '@/domain/plan/plan.generated';

import { flowKey } from './plan-viz-flow-key';

function plan(steps: Step[]): Plan {
  return {
    meta: { id: 'legend', title: 'Explain the flow' },
    problem: { summary: 'Keep the key faithful to the drawing.' },
    teams: [],
    services: ['a', 'b'].map((id) => ({ id: `svc:${id}`, name: id, kind: 'service' })),
    schemas: [{ id: 'sch:reply', name: 'Reply', kind: 'dto' }],
    interfaces: [
      {
        id: 'if:rest',
        service: 'svc:b',
        protocol: 'rest',
        endpoints: [{ id: 'api:fetch', sig: 'GET /items', response: 'sch:reply' }],
      },
    ],
    flows: [{ id: 'flow:legend', name: 'Read items', steps }],
  };
}
const step = (overrides: Partial<Step> = {}): Step => ({
  id: 'flow:legend#fetch',
  from: 'svc:a',
  to: 'svc:b',
  via: 'api:fetch',
  action: 'Read items',
  ...overrides,
});
const diagram = { mode: 'asIs', view: 'diagram', marked: false, walkable: false } as const;

describe('a key describes only the displayed flow', () => {
  it.each(['api:fetch', 'gql:fetch'])(
    'keys the synchronous %s call and its pointer exactly',
    (via) => {
      expect(flowKey(derive(plan([step({ via })])), 'flow:legend', diagram)).toEqual([
        { line: 'solid', label: 'sync call' },
        { glyph: '●', label: 'endpoint it calls' },
      ]);
    },
  );
  it('distinguishes an event, an unrelated link and a missing flow', () => {
    expect(flowKey(derive(plan([step({ via: 'msg:published' })])), 'flow:legend', diagram)).toEqual(
      [{ line: 'dashed', label: 'event' }],
    );
    const other = derive(plan([step({ via: 'svc:other' })]));
    expect(flowKey(other, 'flow:legend', diagram)).toEqual([]);
    expect(flowKey(other, 'flow:missing', diagram)).toEqual([]);
  });
  it.each([{ to: 'svc:a' }, { via: '' }, { via: 'internal' }])(
    'labels an internal step (%j)',
    (overrides) => {
      const key = flowKey(derive(plan([step(overrides)])), 'flow:legend', diagram);
      expect(key).toContainEqual({ glyph: '□', label: 'internal step' });
    },
  );
  it('includes the complete walking, data, change-mark and screen key only when drawn', () => {
    const model = derive(plan([step({ reads: ['sch:reply'], screen: 'scr:page' })]));
    expect(flowKey(model, 'flow:legend', { ...diagram, walkable: true, marked: true })).toEqual([
      { line: 'solid', label: 'sync call' },
      { glyph: '●', label: 'endpoint it calls' },
      { swatch: 'cur', label: 'you are here' },
      { swatch: 'dim', label: 'walked' },
      { glyph: '⛁', label: 'store it reads or writes' },
      { glyph: '◇', label: 'planned changes' },
      { glyph: '◫', label: 'screen the person sees' },
    ]);
    expect(flowKey(model, 'flow:legend', { ...diagram, view: 'sequence', walkable: true })).toEqual(
      [
        { line: 'solid', label: 'sync call' },
        { line: 'dotted', label: 'what the call answers' },
        { glyph: '◫', label: 'screen the person sees' },
      ],
    );
    const writes = derive(plan([step({ via: 'internal', writes: ['sch:reply'] })]));
    expect(flowKey(writes, 'flow:legend', diagram)).toEqual([
      { glyph: '□', label: 'internal step' },
      { glyph: '⛁', label: 'store it reads or writes' },
    ]);
  });
  it('keys sequence replies, failure frames and grouped steps without diagram pointers', () => {
    const model = derive(
      plan([
        step({ fails: 'Unavailable', beat: 'Load' }),
        step({ id: 'flow:legend#again', beat: 'Load' }),
      ]),
    );
    expect(flowKey(model, 'flow:legend', { ...diagram, view: 'sequence' })).toEqual([
      { line: 'solid', label: 'sync call' },
      { line: 'dotted', label: 'what the call answers' },
      { glyph: '▭', label: 'if it fails' },
      { glyph: '▭', label: 'grouped steps' },
    ]);
    expect(
      flowKey(derive(plan([step({ via: 'unknown' })])), 'flow:legend', {
        ...diagram,
        view: 'sequence',
      }),
    ).toEqual([]);
  });
  it('distinguishes added, modified and removed elements in planned views and suppresses them for today', () => {
    const value = plan([step(), step({ id: 'flow:legend#removed', via: 'msg:published' })]);
    value.changes = [
      {
        id: 'chg:legend',
        title: 'Change calls',
        ops: [
          { modify: 'flow:legend#fetch', set: { action: 'Read more items' } },
          { remove: 'flow:legend#removed' },
          {
            add: 'step',
            into: 'flow:legend',
            value: step({ id: 'flow:legend#new', to: 'svc:new', via: 'api:new' }),
          },
        ],
      },
    ];
    const model = derive(value);
    expect(flowKey(model, 'flow:legend', { ...diagram, mode: 'diff' })).toEqual([
      { line: 'solid', label: 'sync call' },
      { line: 'dashed', label: 'event' },
      { glyph: '●', label: 'endpoint it calls' },
      { swatch: 'add', label: 'new' },
      { swatch: 'mod', label: 'works differently' },
      { swatch: 'rem', label: 'removed' },
    ]);
    expect(flowKey(model, 'flow:legend', diagram)).toEqual([
      { line: 'solid', label: 'sync call' },
      { line: 'dashed', label: 'event' },
      { glyph: '●', label: 'endpoint it calls' },
    ]);
  });
});
