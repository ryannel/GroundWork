import { cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { readWorkspaceLibrary } from './workspace-library';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('@/application/legacy-view'), () => ({
  legacyViewOf: () => {
    throw new Error('The library must not project a native workspace through legacyViewOf.');
  },
}));
afterEach(() => vi.unstubAllEnvs());

it('keeps a legacy registration visible while reading native workspaces and plan addresses directly', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-library-'));
  const native = path.join(root, 'model');
  const personal = path.join(root, 'personal');
  await cp(path.resolve('test/fixtures/model'), native, { recursive: true });
  await mkdir(personal);
  await writeFile(
    path.join(personal, 'workspace.yaml'),
    'format: 1\nid: personal\nname: Personal\n',
  );
  vi.stubEnv('GROUNDWORK_WORKSPACES', [native, personal].join(path.delimiter));
  const library = await readWorkspaceLibrary();
  expect(library.cards.map((card) => card.id)).toEqual(['model-fixture']);
  expect(library.cards[0]?.facts).toContain('1 domain');
  expect(library.cards[0]?.href).toBe('/model-fixture/');
  expect(library.cards[0]?.plans[0]?.href).toBe('/model-fixture/plans/confirm/');
  expect(library.pending).toEqual([{ id: 'personal', name: 'Personal' }]);
});
