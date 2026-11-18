import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { parse, stringify } from 'yaml';

import { readModel } from '@/infrastructure/read-model';

import { indexOf, type ModelIndex } from './model-index';
import { areaLandscapeOf, landscapeIntegrations } from './workspace-landscape-areas';

vi.mock(import('server-only'), () => ({}));
let root: string;
let index: ModelIndex;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'groundwork-landscape-areas-'));
  const folder = path.join(root, 'model');
  await cp(path.resolve('test/fixtures/model'), folder, { recursive: true });
  for (const [system, yaml] of [
    [
      'billing',
      [
        'id: sys:billing',
        'name: Billing',
        'components:',
        '  - { id: svc:billing, name: Billing API, kind: service }',
        'relationships:',
        '  - id: rel:bill',
        '    from: svc:billing',
        '    to: svc:ordering',
        '    kind: call',
        '    says: Reads confirmed orders.',
        '    reason: Synthetic fixture.',
        "    cites: ['ev:source']",
      ].join('\n'),
    ],
    ['unhomed', 'id: sys:unhomed\nname: Unhomed system\nmapped: false\n'],
  ] as const) {
    await mkdir(path.join(folder, `domains/orders/systems/${system}`));
    await writeFile(path.join(folder, `domains/orders/systems/${system}/system.yaml`), yaml);
  }
  const file = path.join(folder, 'landscape.yaml');
  const source = parse(await readFile(file, 'utf8')) as { details: unknown[] };
  await writeFile(
    file,
    stringify({
      ...source,
      details: [
        ...source.details,
        { area: 'area:delivery', systems: ['sys:billing'], relationships: [], collaborations: [] },
      ],
    }),
  );
  const loaded = await readModel('model-fixture', root);
  if (loaded === null) throw new Error('Missing landscape fixture');
  index = indexOf(loaded);
});
afterAll(async () => rm(root, { recursive: true }));

it('draws the model areas as links, counted by their home systems', () => {
  const view = areaLandscapeOf(index);
  expect(view?.nodes.map(({ id, href, systemCount }) => [id, href, systemCount])).toEqual(
    expect.arrayContaining([
      ['area:orders', '/model-fixture/areas/orders/', 1],
      ['area:delivery', '/model-fixture/areas/delivery/', 1],
    ]),
  );
  expect(view?.facts).toEqual(['2 areas']);
});

it('connects areas only through recorded integrations, captioned with counts', () => {
  const view = areaLandscapeOf(index);
  if (view === null) throw new Error('Missing landscape');
  expect(view.edges.map(({ from, to, label }) => [from, to, label])).toEqual([
    ['area:delivery', 'area:orders', '1 out · 0 in'],
  ]);
  expect(landscapeIntegrations(view.integrations)).toContainEqual(
    expect.objectContaining({
      kind: 'call',
      callerArea: 'area:delivery',
      providerArea: 'area:orders',
      caller: 'svc:billing',
      provider: 'svc:ordering',
    }),
  );
});

it('reports systems without a home area instead of inventing one', () => {
  const view = areaLandscapeOf(index);
  expect(view?.nodes.map(({ id }) => id).toSorted()).toEqual(['area:delivery', 'area:orders']);
  expect(view?.placementIssues).toEqual([
    expect.stringMatching(/^1 system has no home area: Unhomed system\.$/u),
  ]);
});
