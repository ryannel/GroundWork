import { expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';

import { modelEntityCard } from './model-entity-card';
import { modelContextOf } from './model-reader';

it('uses declared native kinds and team ownership in the existing hover-card shape', () => {
  const context = modelContextOf({ model: queryModel() });
  expect(modelEntityCard(context, 'svc:a')).toMatchObject({
    name: 'A',
    type: 'service',
    status: 'existing',
    team: 'A',
  });
  expect(modelEntityCard(context, 'ext:supplier')).toMatchObject({ name: 'Supplier', team: null });
  expect(modelEntityCard(context, 'api:absent')).toBeNull();
});
