import { expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';

import { indexOf } from './model-index';
import { modelTargetOf } from './model-target';

it('retains authored target stages, shifts and citations without moving current ownership or placement', () => {
  const model = queryModel();
  const native = {
    ...model,
    domains: model.domains.map((domain) => ({
      ...domain,
      target: {
        summary: '**Retain [[svc:b]]**',
        stages: [
          { id: 'stage:first', name: 'First', owners: ['svc:a'] },
          { id: 'stage:last', name: 'Last', from: ['stage:first'], owners: ['ext:supplier'] },
        ],
        shifts: [
          {
            id: 'shift:one',
            name: 'A change',
            today: 'Uses [[svc:a]].',
            target: 'Uses [[ext:supplier]].',
            cites: ['api:a'],
          },
        ],
      },
    })),
  };
  const index = indexOf(native);
  const result = modelTargetOf(index, 'queries');
  expect(result?.stages[1]).toMatchObject({ from: ['First'], owners: [{ id: 'ext:supplier' }] });
  expect(result?.shifts[0]?.cites[0]?.id).toBe('api:a');
  expect(result?.flow.lines).toHaveLength(1);
  expect(result?.refs['svc:a']?.id).toBe('svc:a');
  expect(result?.refs['svc:b']?.id).toBe('svc:b');
  expect(index.owningTeam('svc:a')).toBe('team:a');
  expect(index.place('svc:a')?.system).toBe('sys:a');
  expect(modelTargetOf(index, 'missing')).toBeNull();
  expect(modelTargetOf(indexOf(model), 'queries')).toBeNull();
});
