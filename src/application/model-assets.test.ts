import { expect, it } from 'vitest';

import { modelOp } from '@/../test/fixtures/model-op';
import { emptyQueryModel } from '@/../test/fixtures/model-queries';
import type { ModelPlan, ModelSystem } from '@/domain/workspace-model';

import { modelAssetsOf } from './model-assets';
import { modelContextOf } from './model-reader';
import { selectedPlanProjection } from './plans-index';

it('retains literal workspace paths, Figma and region metadata, and resolves an explicit plan assignment at its own base', () => {
  const system: ModelSystem = {
    id: 'sys:shop',
    name: 'Shop',
    components: [],
    interfaces: [],
    messages: [],
    subscriptions: [],
    jobs: [],
    interactions: [],
    operations: [],
    schemas: [],
    handlers: [],
    narratives: null,
    screens: [
      {
        id: 'scr:shop',
        app: 'app:shop',
        name: 'Shop',
        kind: 'page',
        assets: [
          { file: 'assets/before.png', label: 'Before' },
          { figma: 'https://www.figma.com/design/example', region: 'main' },
        ],
      },
    ],
  };
  const model = {
    ...emptyQueryModel(),
    domains: [{ id: 'dom:shop', name: 'Shop', systems: [system], language: null, target: null }],
  };
  const plan: ModelPlan = {
    meta: { id: 'plan:assets', title: 'Revise the picture' },
    problem: { summary: 'Retain both pictures.' },
    changes: [
      {
        id: 'chg:picture',
        title: 'Picture',
        ops: [modelOp({ modify: 'scr:shop', set: { assets: [{ file: 'assets/after.png' }] } })],
      },
    ],
  };
  const selected = selectedPlanProjection(plan, [plan], model);
  const context = modelContextOf({ plan, before: selected.before, after: selected.after });
  expect(modelAssetsOf(context, 'scr:shop', 'before')[0]?.href).toBe('/queries/assets/before.png');
  expect(modelAssetsOf(context, 'scr:shop', 'before')[1]).toMatchObject({
    figma: 'https://www.figma.com/design/example',
    region: 'main',
  });
  expect(
    modelAssetsOf(context, 'scr:shop', 'after', '/queries/plans/actual-folder/')[0]?.href,
  ).toBe('/queries/plans/actual-folder/assets/after.png');
  expect(modelAssetsOf(context, 'scr:shop', 'after')[0]?.gap).toBe(
    'The plan asset location is not recorded.',
  );
});
