import { describe, expect, it } from 'vitest';

import { queryModel, systemProviderModel } from '@/../test/fixtures/model-queries';
import type { ModelPlan, ModelRepository, WorkspaceModel } from '@/domain/workspace-model';

import { modelInspectionOf, modelInspectionRecords } from './model-inspection';
import { modelContextOf } from './model-reader';

const plan: ModelPlan = {
  meta: { id: 'plan:inspect', title: 'Inspect the actual proposal' },
  problem: {
    summary: 'Keep [[api:a]] visible.',
    scenarios: [{ id: 'sc:normal', title: 'Normal path', story: 'Use [[api:a]].' }],
  },
  story: {
    summary: 'Keep the authored story.',
    scope: ['api:a'],
    stages: [
      {
        id: 'stage:inspect',
        name: 'Inspect',
        summary: 'Read [[api:a]].',
        components: [{ component: 'svc:a' }],
      },
    ],
  },
  changes: [
    {
      id: 'chg:condition',
      title: 'Qualify the request',
      requires: [{ id: 'req:visible', text: 'Keep [[api:a]] visible.' }],
      ops: [{ modify: 'h:a#call' }],
    },
  ],
};
const refs = (groups: readonly { readonly refs: readonly { readonly id: string }[] }[]) =>
  groups.flatMap((group) => group.refs.map((ref) => ref.id));

function projected() {
  const before = queryModel();
  const after: WorkspaceModel = {
    ...before,
    problems: [
      { id: 'h:a#call', kind: 'proposed_effect', message: 'Synthetic unverified proposal' },
    ],
    domains: before.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) => ({
        ...system,
        handlers: system.handlers.map((handler) => ({
          ...handler,
          steps: handler.steps.map((step) =>
            step.id === 'call' ? { ...step, when: 'Approval is recorded' } : step,
          ),
        })),
      })),
    })),
  };
  return modelContextOf({ plan, before, after });
}

describe('native model inspection', () => {
  it('preserves raw nested facts and separates recorded ownership from placement', () => {
    const context = modelContextOf({ model: queryModel() });
    const store = modelInspectionOf(context, 'st:remote');
    expect(store?.raw).toBe(context.afterIndex.get('st:remote')?.data);
    expect(store?.view.owner.map((owner) => owner.id)).toEqual(['team:b', 'svc:a']);
    expect(
      store?.view.uses.find((group) => group.label === 'Placement')?.refs.map((ref) => ref.id),
    ).toContain('sys:b');
    expect(modelInspectionOf(context, 'h:a')?.view.sources[0]?.href).toContain(
      `/blob/${'a'.repeat(40)}/example.ts#L1-L2`,
    );
    expect(modelInspectionOf(context, 'sys:unmapped')?.view.owner).toEqual([]);
  });

  it('represents native boundary, subscription and job kinds with their explicit gaps', () => {
    const context = modelContextOf({ model: systemProviderModel() });
    expect(modelInspectionOf(context, 'sys:unmapped')?.view.type).toBe('unmapped system');
    expect(modelInspectionOf(context, 'ext:supplier')?.view.type).toBe('external party');
    expect(modelInspectionOf(context, 'sub:b')?.gaps).toContainEqual(
      expect.objectContaining({ kind: 'no_handler' }),
    );
    expect(modelInspectionOf(context, 'job:b')?.view.type).toBe('job');
    expect(refs(modelInspectionOf(context, 'api:unmapped-api')?.view.uses ?? [])).toContain(
      'sys:unmapped',
    );
  });

  it('compares supplied before and after facts and preserves proposed-effect gaps and exact attribution', () => {
    const context = projected();
    const before = modelInspectionOf(context, 'h:a#call', 'before');
    const after = modelInspectionOf(context, 'h:a#call');
    expect(before?.raw.when).toBeUndefined();
    expect(after?.raw.when).toBe('Approval is recorded');
    expect(after?.view.status).toBe('modified');
    expect(after?.gaps).toContainEqual(expect.objectContaining({ kind: 'proposed_effect' }));
    expect(after?.view.changes).toEqual([
      { changeId: 'chg:condition', kind: 'modified', summary: 'Qualify the request' },
    ]);
    expect(modelInspectionOf(context, 'svc:a')?.view.changes).toEqual([]);
  });

  it('keeps actual plan metadata and live references without manufacturing model definitions', () => {
    const context = projected();
    const records = modelInspectionRecords(context);
    expect(records.map((record) => record.id)).toEqual(
      expect.arrayContaining(['plan:inspect', 'sc:normal', 'stage:inspect', 'req:visible']),
    );
    expect(modelInspectionOf(context, 'plan:inspect')?.raw).toBe(plan);
    expect(modelInspectionOf(context, 'plan:inspect')?.view.text).toBe(plan.problem.summary);
    expect(modelInspectionOf(context, 'plan:inspect')?.view.sections).toContainEqual({
      label: 'Story',
      text: plan.story?.summary,
    });
    expect(refs(modelInspectionOf(context, 'stage:inspect')?.view.uses ?? [])).toContain('svc:a');
    expect(modelInspectionOf(context, 'api:a')?.view.mentionedIn.map((ref) => ref.id)).toContain(
      'sc:normal',
    );
    expect(records.filter((record) => record.id === 'svc:a')).toHaveLength(1);
  });

  it('keeps added facts out of before and preserves removed ids for inspection', () => {
    const before = queryModel();
    const after: WorkspaceModel = {
      ...before,
      externals: [{ id: 'ext:new', name: 'New boundary' }],
    };
    const context = modelContextOf({ plan, before, after });
    expect(modelInspectionOf(context, 'ext:new', 'before')).toBeNull();
    expect(modelInspectionOf(context, 'ext:new')?.view.status).toBe('added');
    expect(modelInspectionOf(context, 'ext:supplier')).toBeNull();
    expect(modelInspectionOf(context, 'ext:supplier', 'before')?.view.status).toBe('removed');
    expect(modelInspectionRecords(context).map((record) => record.id)).toContain('ext:supplier');
  });

  it('does not mistake object representation ordering for changed facts', () => {
    const before = queryModel();
    const after: WorkspaceModel = {
      ...before,
      externals: [{ name: 'Supplier', id: 'ext:supplier' }],
    };
    expect(
      modelInspectionOf(modelContextOf({ plan, before, after }), 'ext:supplier')?.view.status,
    ).toBe('existing');
  });

  it('retains every incoming caller, entry and effect beyond the first twenty-four', () => {
    const source = queryModel();
    const handler = source.domains[0]?.systems[0]?.handlers[0];
    if (handler === undefined) throw new Error('Synthetic caller fixture is missing');
    const model: WorkspaceModel = {
      ...source,
      domains: source.domains.map((domain) => ({
        ...domain,
        systems: domain.systems.map((system) =>
          system.id === 'sys:a'
            ? {
                ...system,
                handlers: Array.from({ length: 30 }, (_, index) => ({
                  ...handler,
                  id: `h:caller-${String(index)}`,
                  steps: [{ id: 'call', call: 'api:supplier', cites: handler.cites ?? [] }],
                })),
              }
            : system,
        ),
      })),
    };
    const incoming = refs(
      modelInspectionOf(modelContextOf({ model }), 'api:supplier')?.view.usedBy ?? [],
    );
    for (let index = 0; index < 30; index++) {
      expect(incoming).toContain(`h:caller-${String(index)}`);
      expect(incoming).toContain(`h:caller-${String(index)}#call`);
    }
    expect(incoming).toContain('api:a');
  });

  it('uses the selected version when resolving inverse authored references', () => {
    const before = queryModel();
    const after: WorkspaceModel = {
      ...before,
      externals: [{ id: 'ext:supplier', name: 'Supplier', summary: 'Uses [[api:a]].' }],
    };
    const context = modelContextOf({
      plan: { meta: plan.meta, problem: { summary: 'No links' }, changes: [] },
      before,
      after,
    });
    expect(refs(modelInspectionOf(context, 'api:a', 'before')?.view.usedBy ?? [])).not.toContain(
      'ext:supplier',
    );
    expect(refs(modelInspectionOf(context, 'api:a')?.view.usedBy ?? [])).toContain('ext:supplier');
  });
});

it('resolves evidence through its actual pinned repository and retains supporting evidence refs', () => {
  const repository: ModelRepository = {
    repository: {
      format: 'groundwork-evidence/v2',
      repo: 'example/orders',
      commit: 'a'.repeat(40),
      scannedAt: '2026-11-06T00:00:00Z',
      language: 'typescript',
      trackedFiles: 1,
      selectedFiles: 1,
      passes: ['source'],
    },
    records: [
      {
        family: 'files',
        data: { kind: 'file', id: 'ev:file', path: 'apps/orders/Confirm.ts', blob: 'b'.repeat(40) },
      },
      {
        family: 'sources',
        data: {
          kind: 'source',
          id: 'ev:source',
          file: 'ev:file',
          lines: [1, 100],
          host: 'ev:host',
          authority: 'declared',
        },
      },
      {
        family: 'claims',
        data: {
          kind: 'purpose',
          id: 'ev:claim',
          label: 'Inferred',
          statement: 'Synthetic fixture',
          reasoning: 'Synthetic fixture',
          confidence: 'low',
          limitations: [],
          cites: ['ev:source'],
        },
      },
    ],
    discovery: null,
  };
  const context = modelContextOf({ model: { ...queryModel(), evidence: [repository] } });
  const inspection = modelInspectionOf(context, 'ev:claim');
  expect(inspection?.raw).toBe(repository.records[2]?.data);
  expect(inspection?.view.sources).toEqual([
    {
      label: 'example/orders · apps/orders/Confirm.ts:1–100',
      href: `https://github.com/example/orders/blob/${'a'.repeat(40)}/apps/orders/Confirm.ts#L1-L100`,
    },
  ]);
  expect(inspection?.view.facts).toContainEqual({
    label: 'Repository',
    value: 'example/orders',
    href: null,
  });
  expect(inspection?.view.facts).toContainEqual({
    label: 'Commit',
    value: 'a'.repeat(40),
    href: null,
  });
  expect(refs(inspection?.view.uses ?? [])).toContain('ev:source');
  expect(modelInspectionRecords(context).some((record) => record.id.startsWith('ev:'))).toBe(false);
});
