import { describe, expect, it, vi } from 'vitest';

import { createContext, createReport } from '@/application/plan/check-context';
import { checkShapes, type ShapeCheck, type ShapeProblem } from '@/application/plan/check-shape';
import type { Plan } from '@/domain/plan/plan.generated';

function plan(ops: Plan['changes'] = []): Plan {
  return {
    meta: { id: 'shape-check', title: 'Shape check' },
    problem: { summary: 'Validate a legacy overlay against its preserved schema.' },
    teams: [{ id: 'team:orders', name: 'Orders' }],
    services: [{ id: 'svc:orders', name: 'Orders', team: 'team:orders', kind: 'service' }],
    schemas: [
      { id: 'sch:order', kind: 'dto', name: 'Order', fields: [{ name: 'status', type: 'string' }] },
    ],
    changes: ops,
  };
}
function problem(prop?: string, unknownProp = false): ShapeProblem {
  return { prop, unknownProp, tail: [0, 'name'], message: 'Must name the field' };
}

describe('schema checks of modified legacy entities', () => {
  it('directs unknown properties to the preserved schema at the op that introduced them', () => {
    const context = createContext(
      plan([
        { id: 'chg:typo', title: 'Typo', ops: [{ modify: 'svc:orders', set: { typo: true } }] },
      ]),
    );
    const report = createReport(false);
    checkShapes(context, report, () => [problem('typo', true)]);
    expect(report.errors).toEqual([
      {
        path: 'changes[0].ops[0].set.typo[0].name',
        message:
          'typo is not a property of a service; use one of its real props (see the service entry in schema/legacy-plan.schema.json)',
      },
    ]);
  });
  it('validates authored data after stripping graph metadata and synthetic child ids', () => {
    const context = createContext(
      plan([
        {
          id: 'chg:name',
          title: 'Name',
          ops: [
            { modify: 'sch:order', set: { name: 'Renamed' } },
            { modify: 'sch:order#status', set: { type: 'integer' } },
          ],
        },
      ]),
    );
    const shape = vi.fn<ShapeCheck>(() => []);
    const report = createReport(false);
    checkShapes(context, report, shape);
    expect(shape.mock.calls).toEqual([
      [
        'schema',
        {
          id: 'sch:order',
          kind: 'dto',
          name: 'Renamed',
          fields: [{ name: 'status', type: 'integer' }],
        },
      ],
      ['field', { name: 'status', type: 'integer' }],
    ]);
    expect(report.errors).toEqual([]);
  });
  it('blames the last op that changed the failing property and keeps the schema message', () => {
    const context = createContext(
      plan([
        {
          id: 'chg:rename',
          title: 'Rename',
          ops: [
            { modify: 'svc:orders', set: { name: 'First' } },
            { modify: 'svc:orders', set: { name: '' } },
            { modify: 'svc:orders', set: { does: 'Confirms orders' } },
          ],
        },
      ]),
    );
    const report = createReport(false);
    checkShapes(context, report, () => [problem('name')]);
    expect(report.errors).toEqual([
      { path: 'changes[0].ops[1].set.name[0].name', message: 'Must name the field' },
    ]);
  });
  it('reports append and drop failures at their own operation keys', () => {
    const context = createContext(
      plan([
        {
          id: 'chg:links',
          title: 'Links',
          ops: [
            { modify: 'svc:orders', append: { sources: ['bad'] } },
            { modify: 'svc:orders', drop: { sources: ['bad'] } },
          ],
        },
      ]),
    );
    const report = createReport(false);
    checkShapes(context, report, () => [problem('sources')]);
    expect(report.errors).toEqual([
      { path: 'changes[0].ops[1].drop.sources[0].name', message: 'Must name the field' },
    ]);
  });
  it('does not blame unrelated baseline problems or removed entities on an overlay', () => {
    const context = createContext(
      plan([
        {
          id: 'chg:rename',
          title: 'Rename',
          ops: [
            { modify: 'svc:orders', set: { name: 'New name' } },
            { remove: 'svc:orders' },
            { modify: 'sch:order', set: { name: 'Renamed' } },
          ],
        },
      ]),
    );
    const shape = vi.fn<ShapeCheck>(() => [problem(), problem('unmodified')]);
    const report = createReport(false);
    checkShapes(context, report, shape);
    expect(shape).toHaveBeenCalledTimes(1);
    expect(shape).toHaveBeenCalledWith('schema', expect.objectContaining({ name: 'Renamed' }));
    expect(report.errors).toEqual([]);
  });
});
