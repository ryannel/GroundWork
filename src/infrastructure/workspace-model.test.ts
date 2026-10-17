import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { ACME_SOURCES } from '@/../test/fixtures/acme/model';
import { acmeFiles, tempDir, writeWorkspace } from '@/../test/workspace-kit';
import { componentsOf } from '@/domain/workspace';

import { readWorkspaceModel } from './workspace-model';
import { readWorkspaces } from './workspace-store';

vi.mock(import('server-only'), () => ({}));

const root = await tempDir('workspace-model-');
afterAll(async () => rm(root, { recursive: true, force: true }));
await writeWorkspace(path.join(root, 'acme'), acmeFiles());
const scratch = path.resolve(import.meta.dirname, '../../.scratch');

async function acme() {
  const workspaces = await readWorkspaces(root);
  const workspace = workspaces.find(({ id }) => id === 'acme')!;
  return { workspace, model: await readWorkspaceModel(workspace, root) };
}

describe('readWorkspaceModel', () => {
  afterEach(async () => rm(scratch, { recursive: true, force: true }));

  it('reads the model from its files', async () => {
    const { model } = await acme();
    expect(model.story.stages.map(({ name }) => name)).toEqual(['Publish', 'Buy']);
    expect(model.flows.map(({ id }) => id)).toEqual([
      'flow:cancel-order',
      'flow:place-order',
      'flow:publish-product',
    ]);
    expect(model.journeys.map(({ id }) => id)).toEqual(['uj:buy']);
    expect(model.contracts.map(({ system }) => system)).toEqual([
      'products',
      'search',
      'ordering',
      'payments',
      'accounts',
      'shop',
    ]);
    expect(model.contracts.flatMap(({ interfaces }) => interfaces).map(({ id }) => id)).toEqual([
      'if:products-rest',
      'if:search-rest',
      'if:orders-rest',
      'if:payments-rest',
      'if:card-provider',
      'if:shop-bff',
    ]);
    expect(model.languages.map(({ domain }) => domain)).toEqual(['orders']);
    expect(model.keyTerms.terms.map(({ id }) => id)).toEqual(['term:order']);
    expect(model.scans.map(({ repo, facts }) => [repo, facts])).toEqual([['acme/ordering', 9]]);
  });

  it('keeps who said each fact and where in the code', async () => {
    const { model } = await acme();
    expect(model.attribution['svc:products']).toEqual({
      origin: 'extracted',
      sources: [ACME_SOURCES.products],
    });
    expect(model.attribution['api:orders-create']).toEqual({
      origin: 'extracted',
      sources: [ACME_SOURCES.ordersCreate],
    });
    expect(model.attribution['flow:place-order']).toEqual({ origin: 'curated', sources: [] });
    const products = model.contracts.find(({ system }) => system === 'products');
    const service = products?.components.find(({ id }) => id === 'svc:products');
    expect(service?.sources?.[0]?.url).toBe(
      'https://github.com/acme/products/blob/4f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c/cmd/products/main.go#L12-L80',
    );
  });

  it('gives an empty model when there are no files, and reads scans when there are', async () => {
    const { workspace } = await acme();
    const folder = await bareWorkspace(scratch, workspace.id);
    await mkdir(path.join(folder, 'scans', 'acme'), { recursive: true });
    await writeFile(
      path.join(folder, 'scans', 'acme', 'pricing.yaml'),
      [
        'repo: acme/pricing',
        'branch: main',
        'head: 3f9c2e1',
        'scanned_at: 2025-06-01T10:22:00Z',
        'scanner: groundwork-explore@1',
        'files: { "src/price/PriceController.java": 9ab0 }',
        'facts: 214',
      ].join('\n'),
    );
    const model = await readWorkspaceModel(workspace, path.dirname(folder));
    expect(model.flows).toEqual([]);
    expect(model.contracts).toHaveLength(6);
    expect(model.contracts.every(({ interfaces }) => interfaces.length === 0)).toBe(true);
    expect(model.scans).toEqual([
      {
        repo: 'acme/pricing',
        branch: 'main',
        head: '3f9c2e1',
        scannedAt: '2025-06-01T10:22:00Z',
        scanner: 'groundwork-explore@1',
        files: { 'src/price/PriceController.java': '9ab0' },
        facts: 214,
      },
    ]);
    expect(model.attribution).toEqual({});
    expect(componentsOf(workspace).length).toBeGreaterThan(6);
  });

  it('refuses a fact without an origin', async () => {
    const { workspace } = await acme();
    const folder = await bareWorkspace(scratch, workspace.id);
    await mkdir(path.join(folder, 'flows'), { recursive: true });
    await writeFile(path.join(folder, 'flows', 'x.yaml'), 'id: flow:x\nname: X\nsteps: []\n');
    await expect(readWorkspaceModel(workspace, path.dirname(folder))).rejects.toThrow(/origin/u);
  });
});

/** A folder holding one empty workspace with this id, so the model has only what a test writes. */
async function bareWorkspace(folder: string, id: string): Promise<string> {
  await mkdir(folder, { recursive: true });
  const workspace = path.join(await mkdtemp(path.join(folder, 'model-')), id);
  await mkdir(workspace, { recursive: true });
  await writeFile(path.join(workspace, 'workspace.yaml'), `id: ${id}\nname: ${id}\n`);
  return workspace;
}
