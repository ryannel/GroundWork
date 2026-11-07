import { expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';

import { indexOf } from './model-index';
import { modelPageLinks, modelWorkspaceScreens } from './model-pages';

it('links declared domains and systems, including an unmapped system, from the workspace palette', () => {
  const index = indexOf(queryModel());
  expect(modelPageLinks(index)).toEqual({
    'dom:queries': '/queries/queries/',
    'sys:a': '/queries/queries/a/',
    'sys:b': '/queries/queries/b/',
    'sys:unmapped': '/queries/queries/unmapped/',
  });
  expect(modelWorkspaceScreens(index)).toMatchSnapshot('canonical workspace palette destinations');
});
