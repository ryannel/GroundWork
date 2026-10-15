import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { componentsOf } from '@/domain/workspace';

import { readWorkspaceModel } from './workspace-model';
import { readWorkspaces } from './workspace-store';

vi.mock('server-only', () => ({}));

const root = path.resolve(import.meta.dirname, '../../workspaces');
const scratch = path.resolve(import.meta.dirname, '../../.scratch');

async function alder() {
  const workspaces = await readWorkspaces(root);
  const workspace = workspaces.find(({ id }) => id === 'alder-finch')!;
  return { workspace, model: await readWorkspaceModel(workspace, root) };
}

describe('readWorkspaceModel', () => {
  afterEach(async () => rm(scratch, { recursive: true, force: true }));

  it('reads the seeded alder-finch model', async () => {
    const { model } = await alder();
    expect(model.story.stages.map(({ name }) => name)).toEqual([
      'Create',
      'Price',
      'Discover',
      'Buy',
      'Capture',
      'Fulfil',
      'Bill',
      'Tell',
    ]);
    expect(model.flows.map(({ id }) => id)).toContain('flow:reserve');
    expect(model.journeys.map(({ id }) => id)).toEqual(['uj:buy-product', 'uj:revisit-product']);
    expect(model.contracts.flatMap(({ interfaces }) => interfaces).length).toBeGreaterThan(5);
    expect(model.scans).toEqual([]);
  });

  it('keeps who said each fact and where in the code', async () => {
    const { model } = await alder();
    expect(model.attribution['svc:allocation']).toEqual({
      origin: 'seeded',
      sources: [
        {
          repo: 'alder-finch/fulfilment',
          path: 'allocation/allocate.py',
          commit: '6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a',
          lines: [40, 210],
        },
      ],
    });
    expect(model.attribution['flow:reserve']?.origin).toBe('seeded');
    const fulfilment = model.contracts.find(({ system }) => system === 'fulfilment');
    const allocation = fulfilment?.components.find(({ id }) => id === 'svc:allocation');
    expect(allocation?.sources?.[0]?.url).toBe(
      'https://github.com/alder-finch/fulfilment/blob/6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a/allocation/allocate.py#L40-L210',
    );
  });

  it('gives an empty model when there are no files, and reads scans when there are', async () => {
    const { workspace } = await alder();
    const folder = path.join(await mkdtempIn(scratch), workspace.id);
    await mkdir(path.join(folder, 'scans', 'alder-finch'), { recursive: true });
    await writeFile(
      path.join(folder, 'scans', 'alder-finch', 'pricing.yaml'),
      [
        'repo: alder-finch/pricing',
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
    expect(model.contracts).toHaveLength(14);
    expect(model.contracts.every(({ interfaces }) => interfaces.length === 0)).toBe(true);
    expect(model.scans).toEqual([
      {
        repo: 'alder-finch/pricing',
        branch: 'main',
        head: '3f9c2e1',
        scannedAt: '2025-06-01T10:22:00Z',
        scanner: 'groundwork-explore@1',
        files: { 'src/price/PriceController.java': '9ab0' },
        facts: 214,
      },
    ]);
    expect(componentsOf(workspace).length).toBeGreaterThan(14);
  });

  it('refuses a fact without an origin', async () => {
    const { workspace } = await alder();
    const folder = path.join(await mkdtempIn(scratch), workspace.id);
    await mkdir(path.join(folder, 'flows'), { recursive: true });
    await writeFile(path.join(folder, 'flows', 'x.yaml'), 'id: flow:x\nname: X\nsteps: []\n');
    await expect(readWorkspaceModel(workspace, path.dirname(folder))).rejects.toThrow(/origin/);
  });
});

async function mkdtempIn(folder: string): Promise<string> {
  await mkdir(folder, { recursive: true });
  return mkdtemp(path.join(folder, 'model-'));
}
