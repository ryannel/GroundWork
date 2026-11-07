import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, it, vi } from 'vitest';
import { parse, stringify } from 'yaml';

import { migratedEvidenceId } from '@/../tools/migrate-model/evidence';
import { fingerprint } from '@/../tools/migrate-model/review';
import { repositoryInventory } from '@/../tools/scan-repository-inventory';
import { passFixture } from '@/../tools/scan-repository-pass-fixture';

vi.mock(import('server-only'), () => ({}));

const MODEL = 'domains/orders/systems/ordering';

async function write(folder: string, relative: string, value: unknown): Promise<void> {
  const file = path.join(folder, relative);
  await mkdir(path.dirname(file), { recursive: true });
  const text = relative.endsWith('.yaml') ? stringify(value) : `${JSON.stringify(value)}\n`;
  await writeFile(file, text);
}

it('adds a step using source promoted from the pinned cache and keeps it on replay', async () => {
  const fixture = passFixture({
    'orders.ts': 'export const orders = [];\nexport const count = orders.length;\n',
  });
  try {
    const { commit, files } = repositoryInventory(fixture.repository);
    const blob = files[0]?.blob;
    if (blob === undefined) throw new Error('Missing source blob.');
    const repo = 'org/repo';
    const workspace = path.join(fixture.root, 'workspace');
    const first = path.join(fixture.root, 'first');
    const second = path.join(fixture.root, 'second');
    const repository = 'evidence/org/repo';
    const handlers = `${MODEL}/handlers/ordering.yaml`;
    const prior = {
      id: 'h:orders',
      component: 'svc:ordering',
      on: 'api:orders',
      steps: [{ id: 'load', does: 'Read the orders', cites: ['orders:orders.ts#L1'] }],
    };
    await write(workspace, 'workspace.yaml', {
      format: 2,
      id: 'scan-fixture',
      name: 'Scan fixture',
    });
    await write(workspace, 'domains/orders/domain.yaml', { id: 'dom:orders', name: 'Orders' });
    await write(workspace, `${MODEL}/system.yaml`, {
      id: 'sys:ordering',
      name: 'Ordering',
      homes: { orders: { repo } },
      components: [{ id: 'svc:ordering', kind: 'service', name: 'Ordering' }],
    });
    await write(workspace, `${MODEL}/contracts.yaml`, {
      interfaces: [
        {
          id: 'if:orders',
          component: 'svc:ordering',
          kind: 'rest',
          entries: [{ id: 'api:orders', method: 'GET', path: '/orders' }],
        },
      ],
    });
    await write(workspace, handlers, [prior]);
    await write(workspace, `${repository}/repository.json`, {
      format: 'groundwork-evidence/v2',
      repo,
      commit,
      scannedAt: '2026-10-25T00:00:00Z',
      language: 'typescript',
      trackedFiles: 1,
      selectedFiles: 1,
      passes: ['source'],
    });
    await write(workspace, `${repository}/files.jsonl`, {
      id: 'ev:file',
      kind: 'file',
      path: 'orders.ts',
      blob,
    });
    await write(workspace, `${repository}/hosts.jsonl`, {
      id: 'ev:host',
      kind: 'host',
      component: 'scope:org/repo:unknown',
      environment: 'unknown',
      cites: ['ev:file'],
    });
    await write(workspace, `${repository}/sources.jsonl`, {
      id: 'ev:existing',
      kind: 'source',
      file: 'ev:file',
      host: 'ev:host',
      lines: [1, 1],
      authority: 'declared',
    });
    const cache = {
      id: 'source:new',
      kind: 'source',
      path: 'orders.ts',
      blob,
      host: 'ev:host',
      lines: [2, 2],
      authority: 'declared',
    };
    await write(fixture.root, 'sources.jsonl', cache);
    const digest = createHash('sha256')
      .update(`${JSON.stringify(cache)}\n`)
      .digest('hex');
    await write(fixture.root, 'receipt.json', {
      format: 'groundwork-analysis-cache/v1',
      repo,
      commit,
      files: { sources: digest },
    });
    const cite = migratedEvidenceId(repo, cache.id);
    const observed = {
      ...prior,
      steps: [
        { id: 'renamed-load', does: 'Read the orders', cites: ['ev:existing'] },
        { id: 'count', does: 'Count the orders', cites: [cite] },
      ],
    };
    await write(fixture.root, 'accepted.json', {
      repo,
      commit,
      handlers: [{ complete: true, before: fingerprint(prior), observed }],
    });
    const run = (source: string, out: string): unknown => {
      const result = execFileSync(
        process.execPath,
        [
          '--import',
          './tools/register.ts',
          '--conditions=react-server',
          'tools/scan-model.ts',
          '--workspace',
          'scan-fixture',
          '--repo',
          repo,
          '--commit',
          commit,
          '--clone-root',
          fixture.root,
          '--analysis',
          path.join(fixture.root, 'receipt.json'),
          '--accept',
          path.join(fixture.root, 'accepted.json'),
          '--out',
          out,
        ],
        { encoding: 'utf8', env: { ...process.env, GROUNDWORK_WORKSPACES: source } },
      );
      return JSON.parse(result);
    };
    expect(run(workspace, first)).toMatchObject({
      promotedAnalysis: 1,
      ambiguousStepMatches: [],
      retiredSteps: [],
    });
    const text = await readFile(path.join(first, handlers), 'utf8');
    expect(parse(text)).toEqual([
      { ...observed, steps: [{ ...observed.steps[0], id: 'load' }, observed.steps[1]] },
    ]);
    expect(run(first, second)).toMatchObject({
      promotedAnalysis: 0,
      updatedFiles: 0,
      ambiguousStepMatches: [],
    });
    await expect(readFile(path.join(second, handlers), 'utf8')).resolves.toBe(text);
  } finally {
    fixture.dispose();
  }
});
