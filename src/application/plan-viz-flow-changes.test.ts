import { describe, expect, it } from 'vitest';

import { derive } from '@/application/plan/derive';
import { flowSteps } from '@/application/plan/flow-steps';
import type { Plan } from '@/domain/plan/plan.generated';

import { changeMarkers, decisionsOf, stepChanges } from './plan-viz-flow-changes';

function plan(): Plan {
  return {
    meta: { id: 'flow-changes', title: 'Explain changes' },
    teams: [],
    problem: { summary: 'Keep changes traceable from each step.' },
    services: [
      { id: 'svc:a', name: 'A', kind: 'service' },
      { id: 'svc:b', name: 'B', kind: 'service' },
    ],
    interfaces: [
      {
        id: 'if:b',
        service: 'svc:b',
        protocol: 'rest',
        endpoints: [{ id: 'api:read', sig: 'GET /records' }],
      },
    ],
    schemas: [
      { id: 'sch:record', name: 'Record', kind: 'dto', fields: [{ name: 'id', type: 'string' }] },
    ],
    flows: [
      {
        id: 'flow:read',
        name: 'Read',
        steps: [
          {
            id: 'flow:read#call',
            from: 'svc:a',
            to: 'svc:b',
            via: 'api:read',
            action: 'Read',
            reads: ['sch:record#id'],
            writes: ['sch:record', 'sch:record#id'],
          },
          { id: 'flow:read#keep', from: 'svc:b', to: 'svc:b', via: 'internal', action: 'Keep' },
        ],
      },
    ],
    decisions: [{ id: 'dec:contract', title: 'Change the contract', status: 'proposed' }],
    changes: [
      {
        id: 'chg:api',
        title: 'Change the API',
        decisions: ['dec:contract'],
        ops: [{ modify: 'api:read', set: { sig: 'GET /v2/records' } }],
      },
      {
        id: 'chg:record',
        title: 'Change the record',
        decisions: ['dec:contract'],
        ops: [{ modify: 'sch:record#id', set: { type: 'uuid' } }],
      },
      {
        id: 'chg:step',
        title: 'Change the action',
        ops: [{ modify: 'flow:read#call', set: { action: 'Read v2' } }],
      },
      {
        id: 'chg:insert',
        title: 'Add validation',
        ops: [
          {
            add: 'step',
            into: 'flow:read',
            after: 'flow:read#call',
            value: {
              id: 'flow:read#validate',
              from: 'svc:b',
              to: 'svc:b',
              via: 'internal',
              action: 'Validate',
            },
          },
          {
            add: 'step',
            into: 'flow:read',
            after: 'missing',
            value: {
              id: 'flow:read#finish',
              from: 'svc:b',
              to: 'svc:b',
              via: 'internal',
              action: '',
            },
          },
        ],
      },
    ],
  };
}
describe('changes carried by a flow step', () => {
  it('pins each changed root once and explains inserted steps at their actual anchors', () => {
    const model = derive(plan());
    const marks = changeMarkers(model, 'flow:read');
    expect(marks.markers).toEqual({ 'flow:read#call': '◇', 'flow:read#keep': '◇' });
    expect(marks.pins).toEqual({
      'flow:read#call': ['flow:read', 'sch:record'],
      'flow:read#keep': ['flow:read'],
    });
    expect(marks.reasons['flow:read#call']).toContain('a new step follows: “Validate”');
    expect(marks.reasons['flow:read#call']).toContain('GET /v2/records is modified');
    expect(marks.reasons['flow:read#keep']).toEqual(['a new step follows: “flow:read#finish”']);
    expect(marks.reasons['flow:read#call']?.some((reason) => /^[+~×−-]\s/u.test(reason))).toBe(
      false,
    );
    expect(changeMarkers(model, 'api:read')).toEqual({ markers: {}, reasons: {}, pins: {} });
    expect(changeMarkers(model, 'missing')).toEqual({ markers: {}, reasons: {}, pins: {} });
  });
  it('orders interface, record and step changes by specificity, deduplicating reads and writes', () => {
    const model = derive(plan());
    const step = flowSteps(model, 'flow:read', 'asIs')[0]!;
    expect(stepChanges(model, step)).toEqual(['chg:api', 'chg:record', 'chg:step']);
    expect(decisionsOf(model, ['chg:api', 'chg:record', 'missing', 'chg:step'])).toEqual([
      'dec:contract',
    ]);
    expect(decisionsOf(model, [])).toEqual([]);
  });
  it('leaves unchanged work unmarked and changes unknown to the plan visible as gaps', () => {
    const value = plan();
    value.changes = [];
    const model = derive(value);
    expect(changeMarkers(model, 'flow:read')).toEqual({ markers: {}, reasons: {}, pins: {} });
    expect(stepChanges(model, flowSteps(model, 'flow:read')[0]!)).toEqual([]);
    expect(stepChanges(model, { ...flowSteps(model, 'flow:read')[0]!, via: '' })).toEqual([]);
  });
  it('keeps a removal understandable even when no property-level explanation exists', () => {
    const value = plan();
    value.changes = [
      { id: 'chg:remove', title: 'Remove the call', ops: [{ remove: 'flow:read#call' }] },
    ];
    const model = derive(value);
    expect(
      changeMarkers({ ...model, diff: () => [] }, 'flow:read').reasons['flow:read#call'],
    ).toEqual(['this step is removed']);
    const changed = derive(plan());
    expect(
      changeMarkers({ ...changed, diff: () => [] }, 'flow:read').reasons['flow:read#call'],
    ).toContain('this step changes');
  });
});
