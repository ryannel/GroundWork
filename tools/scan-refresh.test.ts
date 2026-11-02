import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fixtureCommit, fixtureGit } from '@/infrastructure/scan/freshness-git-fixture';
import type { ScanScope } from '@/infrastructure/scan/scan-scope';
import { publishScopedScan } from '@/infrastructure/scan/scoped-publication';
import { runScopedSources } from '@/infrastructure/scan/scoped-source-store';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
const nodeCommand = ['--import', './tools/register.ts', '--conditions=react-server'];
const command = [...nodeCommand, 'tools/scan-refresh.ts'];
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'scan-refresh-'));
  folders.push(root);
  const repository = path.join(root, 'org', 'repo');
  const output = path.join(root, 'output');
  mkdirSync(repository, { recursive: true });
  fixtureGit(repository, ['init', '-q']);
  fixtureGit(repository, ['config', 'user.email', 'fixture@example.test']);
  fixtureGit(repository, ['config', 'user.name', 'Fixture']);
  const initial = fixtureCommit(repository, {
    'source.ts': 'export function action() { return 1; }',
    'stable.ts': 'export function stable() { return 3; }',
    'unselected.ts': 'unselected',
  });
  const scope: ScanScope = {
    format: 'scan-scope/v1',
    workspace: 'fixture',
    id: 'fixture',
    repo: 'org/repo',
    commit: initial.commit,
    ref: 'HEAD',
    files: [
      { path: 'source.ts', language: 'typescript', environment: 'server' },
      { path: 'stable.ts', language: 'typescript', environment: 'server' },
    ],
    questions: [
      {
        id: 'action',
        profile: 'action',
        path: 'source.ts',
        symbol: 'action',
        checks: [{ kind: 'value', text: 'Return value' }],
      },
    ],
  };
  const result = await runScopedSources(scope, {
    authority: scope.workspace,
    cloneRoot: root,
    cacheDirectory: path.join(output, 'cache'),
  });
  const publication = await publishScopedScan(output, { scope, result });
  const scopeFile = path.join(output, publication.generation, 'scope.json');
  const baselineFile = path.join(output, publication.generation, 'baseline.json');
  return { root, repository, output, scope, scopeFile, baselineFile };
}
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe('bounded refresh command', () => {
  it('parses one changed selected file, reuses the other, and publishes the updated pinned manifest', async () => {
    const input = await fixture();
    const current = fixtureCommit(input.repository, {
      'source.ts': 'export function action() { return 2; }',
      'unselected.ts': 'changed but outside scope',
    });
    const execution = spawnSync(
      process.execPath,
      [...command, input.scopeFile, input.baselineFile, input.root, input.output],
      { encoding: 'utf8' },
    );
    expect(execution.status).toBe(0);
    expect(execution.stderr).toBe('');
    const result: unknown = JSON.parse(execution.stdout);
    expect(result).toMatchObject({
      status: 'partial',
      commit: current.commit,
      changedSelectedFiles: ['source.ts'],
      stats: { blobReads: 1, parsedFiles: 1, indexHits: 1, reusedFiles: 1 },
    });
    const selection: unknown = JSON.parse(
      readFileSync(path.join(input.output, 'selection.json'), 'utf8'),
    );
    expect(selection).toMatchObject({ source: { commit: current.commit } });
    expect(readFileSync(input.scopeFile, 'utf8')).toContain(input.scope.commit);
  }, 15_000);

  it('checks current provenance automatically and skips extraction for an unchanged publication', async () => {
    const input = await fixture();
    const previousSelection = readFileSync(path.join(input.output, 'selection.json'), 'utf8');
    const execution = spawnSync(
      process.execPath,
      [...command, input.scopeFile, input.baselineFile, input.root, input.output],
      { encoding: 'utf8' },
    );
    expect(execution.status).toBe(0);
    const result: unknown = JSON.parse(execution.stdout);
    expect(result).toMatchObject({
      status: 'partial',
      unchanged: true,
      stats: { blobReads: 0, parsedFiles: 0, indexHits: 0 },
    });
    expect(readFileSync(path.join(input.output, 'selection.json'), 'utf8')).toBe(previousSelection);
    const check = spawnSync(
      process.execPath,
      [
        ...nodeCommand,
        'tools/scan-freshness.ts',
        input.baselineFile,
        input.repository,
        '--scope',
        input.scopeFile,
      ],
      { encoding: 'utf8' },
    );
    expect(check.status).toBe(0);
    const freshness: unknown = JSON.parse(check.stdout);
    expect(freshness).toMatchObject({
      verification: 'analysis',
      rescanRequired: false,
      freshness: { sourceCurrent: true },
    });
  });

  it('blocks selected renames before changing the prior publication', async () => {
    const input = await fixture();
    const selection = readFileSync(path.join(input.output, 'selection.json'), 'utf8');
    fixtureGit(input.repository, ['mv', 'source.ts', 'renamed.ts']);
    fixtureGit(input.repository, ['commit', '-qm', 'Rename selected file']);
    const execution = spawnSync(
      process.execPath,
      [...command, input.scopeFile, input.baselineFile, input.root, input.output],
      { encoding: 'utf8' },
    );
    expect(execution.status).toBe(1);
    expect(execution.stderr).toContain('deleted or renamed');
    expect(readFileSync(path.join(input.output, 'selection.json'), 'utf8')).toBe(selection);
  });

  it('rejects missing arguments and conflicting provenance flags', async () => {
    const missing = spawnSync(process.execPath, command, { encoding: 'utf8' });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('Usage: scan:refresh');
    const input = await fixture();
    const conflict = spawnSync(
      process.execPath,
      [
        ...nodeCommand,
        'tools/scan-freshness.ts',
        input.baselineFile,
        input.repository,
        '--scope',
        input.scopeFile,
        '--provenance',
        input.baselineFile,
      ],
      { encoding: 'utf8' },
    );
    expect(conflict.status).toBe(1);
    expect(conflict.stderr).toContain('not both');
  });
});
