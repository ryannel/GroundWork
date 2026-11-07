import { expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelPlan } from '@/domain/workspace-model';

import { modelContextOf } from './model-reader';
import { modelPaletteEntries } from './model-search';
import { searchPalette } from './plan-pages-search';
import { selectedPlanProjection } from './plans-index';

it('finds native boundaries, nested facts and authored scope without deriving an old graph', () => {
  const context = modelContextOf({ model: queryModel() });
  const entries = modelPaletteEntries(context, []);
  expect(entries.find((entry) => entry.target === 'ext:supplier')).toMatchObject({
    group: 'external',
    label: 'Supplier',
  });
  expect(entries.find((entry) => entry.target === 'h:a#call')?.kind).toBe('part');
  expect(
    searchPalette(entries, 'supplier', null).some((entry) => entry.target === 'ext:supplier'),
  ).toBe(true);
});
it('keeps removed identities and actual plan metadata searchable from supplied before/after values', () => {
  const current = queryModel();
  const plan: ModelPlan = {
    meta: { id: 'plan:search', title: 'Retire the known request' },
    problem: { summary: 'Retain the before record.' },
    changes: [
      { id: 'chg:retire', title: 'Retire the supplier request', ops: [{ remove: 'h:a#call' }] },
    ],
  };
  const projected = selectedPlanProjection(plan, [plan], current);
  const context = modelContextOf({ plan, before: projected.before, after: projected.after });
  const entries = modelPaletteEntries(context, []);
  expect(entries.find((entry) => entry.target === 'h:a#call')).toBeDefined();
  expect(entries.find((entry) => entry.target === 'chg:retire')?.label).toBe(
    'Retire the supplier request',
  );
});
