import { expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';

import { indexOf } from './model-index';
import { modelInspectionOf } from './model-inspection';
import { modelReferenceOf, modelReferencePage } from './model-reference';

it('uses actual canonical kinds, keeps clientless documents and filters full facts before pagination', () => {
  const base = queryModel();
  const message = 'The selected document path cannot be resolved through the recorded graph types.';
  const repeated = Array.from({ length: 874 }, (_, number) => ({
    id: 'gql:unknown',
    kind: 'unmapped_target',
    message,
    reference: `Selection.field${String(number)}`,
  }));
  const model = {
    ...base,
    problems: [...base.problems, ...repeated],
    domains: base.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) =>
        system.id === 'sys:b'
          ? {
              ...system,
              operations: [
                {
                  id: 'gql:unknown',
                  name: 'Unknown client document',
                  graph: 'graph:public',
                  document: 'query Saved { field }',
                },
              ],
            }
          : system,
      ),
    })),
  };
  const index = indexOf(model);
  expect(modelReferenceOf(index).find((entry) => entry.kind === 'operations')?.count).toBe(1);
  const operation = modelReferencePage(index, 'operations', { q: 'Saved' })?.rows[0];
  expect(operation?.chip.id).toBe('gql:unknown');
  expect(operation?.gaps.some((gap) => gap.kind === 'no_client')).toBe(true);
  expect(operation?.gaps).toContainEqual({ kind: 'unmapped_target', message, count: 874 });
  expect(operation?.gaps.filter((gap) => gap.message === message)).toHaveLength(1);
  const inspection = modelInspectionOf(
    { plan: null, profile: null, beforeIndex: index, afterIndex: index },
    'gql:unknown',
  );
  expect(inspection?.gaps.filter((gap) => gap.message === message)).toEqual(repeated);
  expect(
    modelReferencePage(index, 'stores', { team: 'b' })?.rows.some(
      (row) => row.chip.id === 'st:remote',
    ),
  ).toBe(true);
  expect(modelReferencePage(index, 'stores', { q: 'missing' })).toMatchObject({
    total: 0,
    pages: 1,
  });
  expect(modelReferencePage(index, 'unrecognised')).toBeNull();
  const many = indexOf({
    ...base,
    externals: Array.from({ length: 65 }, (_, number) => ({
      id: `ext:external-${String(number)}`,
      name: `External ${String(number)}`,
      summary: number === 64 ? 'Only this contains the needle' : 'Recorded boundary',
    })),
  });
  expect(modelReferencePage(many, 'components', { q: 'needle', page: '100' })).toMatchObject({
    total: 1,
    query: { page: 1 },
    rows: [{ chip: { id: 'ext:external-64' } }],
  });
});
