import { expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';

import { modelChipOf, modelKindPresentation } from './model-chip';
import { indexOf } from './model-index';

it('names native component and boundary kinds without treating an external party as a service', () => {
  const index = indexOf(queryModel());
  expect(modelChipOf(index, 'ext:supplier')).toMatchObject({
    id: 'ext:supplier',
    label: 'Supplier',
    word: 'external party',
    glyph: '◇',
    missing: false,
  });
  expect(modelChipOf(index, 'st:remote').mono).toBe(true);
  expect(modelChipOf(index, 'api:missing')).toMatchObject({ id: 'api:missing', missing: true });
  expect(modelKindPresentation('subscription').word).toBe('subscription');
  expect(modelKindPresentation('workItem').word).toBe('work item');
});
