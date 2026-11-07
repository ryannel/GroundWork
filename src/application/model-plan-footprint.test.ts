import { beforeAll, describe, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import type { ModelOp } from '@/domain/plan-apply';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { modelPlanDomainsOf, modelPlanFootprintOf } from './model-plan-footprint';

vi.mock(import('server-only'), () => ({}));
let checkOp: (value: unknown) => value is ModelOp;
beforeAll(async () => {
  checkOp = await modelValidator('plan', 'op');
});

function plan(id: string, values: readonly unknown[], buildsOn: readonly string[] = []): ModelPlan {
  const ops = values.map((value) => {
    if (!checkOp(value)) throw new Error('Invalid synthetic plan operation');
    return value;
  });
  return {
    meta: { id, title: id },
    problem: { summary: 'A synthetic footprint' },
    builds_on: buildsOn,
    changes: [{ id: 'chg:one', title: 'A change', ops }],
  };
}
function fixture(): WorkspaceModel {
  const original = queryModel();
  const domain = original.domains[0];
  if (domain === undefined) throw new Error('Missing fixture domain');
  return {
    ...original,
    aliases: { 'st:old-remote': { to: 'st:remote' } },
    domains: [
      { ...domain, systems: domain.systems.filter((system) => system.id !== 'sys:b') },
      {
        ...domain,
        id: 'dom:remote',
        name: 'Remote',
        systems: domain.systems.filter((system) => system.id === 'sys:b'),
      },
    ],
  };
}
describe('native plan domain footprint', () => {
  it('uses current containment for a store and its alias, without moving it to its cited owner', () => {
    const current = fixture();
    const before = JSON.stringify(current);
    const chosen = plan('plan:store', [
      { modify: 'st:old-remote', set: { name: 'Revised remote store' } },
    ]);
    expect(modelPlanDomainsOf(chosen, [chosen], indexOf(current))).toEqual({
      domains: ['dom:remote'],
      gaps: [],
    });
    expect(JSON.stringify(current)).toBe(before);
  });

  it('walks explicitly added ancestor parents and nested qualified entries without applying a model', () => {
    const base = plan('plan:base', [
      { add: 'domain', value: { id: 'dom:new', name: 'New domain' } },
      {
        add: 'system',
        into: 'dom:new',
        value: { id: 'sys:new', name: 'New system', components: [] },
      },
      {
        add: 'component',
        into: 'sys:new',
        value: { id: 'svc:new', kind: 'service', name: 'New component' },
      },
      {
        add: 'interface',
        into: 'sys:new',
        value: {
          id: 'if:new',
          kind: 'rest',
          component: 'svc:new',
          entries: [{ id: 'api:new', method: 'GET', path: '/new' }],
        },
      },
      {
        add: 'schema',
        into: 'sys:new',
        value: {
          id: 'sch:new',
          kind: 'record',
          fields: [{ id: 'value', name: 'value', type: 'string' }],
        },
      },
    ]);
    const chosen = plan(
      'plan:chosen',
      [
        { modify: 'api:new', set: { path: '/newer' } },
        { modify: 'sch:new#value', set: { name: 'Revised field' } },
      ],
      ['plan:base'],
    );
    expect(modelPlanDomainsOf(chosen, [chosen, base], indexOf(fixture()))).toEqual({
      domains: ['dom:new'],
      gaps: [],
    });
  });

  it('counts only this plan’s changed domains, plus real system code homes named by work', () => {
    const base = plan('plan:base', [{ modify: 'svc:a', set: { name: 'Ancestor only' } }]);
    const chosen: ModelPlan = {
      ...plan('plan:work', [], ['plan:base']),
      work_items: [{ id: 'wi:one', title: 'Work in B', team: 'team:b', repo: 'fixture/b' }],
    };
    const unrelated = plan('plan:unrelated', [
      { add: 'domain', value: { id: 'dom:unrelated', name: 'Unrelated' } },
    ]);
    expect(modelPlanDomainsOf(chosen, [base, chosen, unrelated], indexOf(fixture()))).toEqual({
      domains: ['dom:remote'],
      gaps: [],
    });
  });

  it('retains unknown placement as a specific gap and rejects invalid dependency graphs', () => {
    const index = indexOf(fixture());
    const unknown = plan('plan:unknown', [{ modify: 'api:unmapped', set: { path: '/unknown' } }]);
    expect(modelPlanDomainsOf(unknown, [unknown], index)).toMatchObject({
      domains: [],
      gaps: [{ id: 'plan:unknown', kind: 'unknown_plan_placement', reference: 'api:unmapped' }],
    });
    const missing = plan('plan:missing', [], ['plan:absent']);
    expect(() => modelPlanDomainsOf(missing, [missing], index)).toThrow('Missing plan dependency');
    const cycle = plan('plan:cycle', [], ['plan:cycle']);
    expect(() => modelPlanDomainsOf(cycle, [cycle], index)).toThrow('Cyclic plan dependency');
    const one = plan('plan:one', [{ modify: 'svc:a', set: { name: 'One' } }]);
    const two = plan('plan:two', [{ modify: 'svc:a', set: { name: 'Two' } }]);
    const conflict = plan('plan:conflict', [], ['plan:one', 'plan:two']);
    expect(() => modelPlanDomainsOf(conflict, [one, two, conflict], index)).toThrow(
      'Unordered plan ancestors',
    );
  });

  it('locates a local field addition under its declared schema parent', () => {
    const chosen = plan('plan:field', [
      { add: 'field', into: 'sch:remote', value: { id: 'extra', name: 'Extra', type: 'string' } },
    ]);
    expect(modelPlanDomainsOf(chosen, [chosen], indexOf(fixture()))).toEqual({
      domains: ['dom:remote'],
      gaps: [],
    });
  });
  it('reports a work repository whose system has not been mapped', () => {
    const chosen: ModelPlan = {
      ...plan('plan:unknown-work', []),
      work_items: [
        { id: 'wi:unknown', title: 'Work elsewhere', team: 'team:a', repo: 'fixture/unknown' },
      ],
    };
    expect(modelPlanDomainsOf(chosen, [chosen], indexOf(fixture()))).toMatchObject({
      domains: [],
      gaps: [{ kind: 'unknown_work_repository', reference: 'fixture/unknown' }],
    });
  });
  it('exposes exact current and proposed systems for native system plan links', () => {
    const index = indexOf(fixture());
    const base = plan('plan:base-system', [
      {
        add: 'system',
        into: 'dom:queries',
        value: { id: 'sys:new', name: 'New system', components: [] },
      },
      { add: 'component', into: 'sys:new', value: { id: 'svc:new', kind: 'service', name: 'New' } },
    ]);
    const chosen = plan(
      'plan:system-footprint',
      [
        { modify: 'svc:new', set: { name: 'Revised' } },
        { modify: 'st:old-remote', set: { name: 'Revised resource' } },
      ],
      ['plan:base-system'],
    );
    expect(modelPlanFootprintOf(chosen, [base, chosen], index)).toEqual({
      domains: ['dom:queries', 'dom:remote'],
      systems: ['sys:b', 'sys:new'],
      gaps: [],
    });
  });
});
