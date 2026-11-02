import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock(import('server-only'), () => ({}));

const { pruneEvidence, writeRepositoryEvidence } =
  await import('@/infrastructure/scan-explorer/evidence-files');
const { buildEvidenceIndex } =
  await import('@/infrastructure/scan-explorer/evidence-index-builder');
const { evidenceIndex } = await import('./evidence-index');

const made: string[] = [];
afterAll(async () => {
  await Promise.all(made.map(async (dir) => rm(dir, { recursive: true, force: true })));
});

async function scratchWorkspace(): Promise<string> {
  const scratch = path.join(process.cwd(), 'node_modules', '.cache');
  await mkdir(scratch, { recursive: true });
  const dir = await mkdtemp(path.join(scratch, 'evidence-index-'));
  made.push(dir);
  return dir;
}

const repository = {
  format: 'groundwork-evidence/v1',
  repo: 'acme/profile-api',
  commit: 'abc123',
  scannedAt: '2026-10-25T00:00:00Z',
  language: 'csharp',
  trackedFiles: 1,
  selectedFiles: 1,
  passes: ['source', 'discovery'],
} as const;

const families = new Map([
  [
    'files',
    [{ kind: 'file', id: 'file:Api/SettingsController.cs', path: 'Api/SettingsController.cs' }],
  ],
  [
    'sources',
    [{ kind: 'source', id: 'source:1', path: 'Api/SettingsController.cs', lines: [10, 24] }],
  ],
  [
    'framework',
    [
      {
        kind: 'aspnet_route_binding',
        id: 'aspnet:1',
        source: 'source:1',
        httpMethods: ['GET'],
        template: 'v1/accounts/settings',
      },
    ],
  ],
  [
    'claims',
    [{ kind: 'purpose', id: 'claim:1', statement: 'Lets a customer read their account settings' }],
  ],
]);

const analysis = new Map([
  [
    'bindings',
    [{ kind: 'csharp_symbol_binding', id: 'binding:1', source: 'source:2', owner: 'aspnet:1' }],
  ],
  [
    'sources',
    [{ kind: 'source', id: 'source:2', path: 'Api/SettingsController.cs', lines: [12, 12] }],
  ],
]);

async function indexed(): Promise<{ readonly workspace: string }> {
  const workspace = await scratchWorkspace();
  await writeRepositoryEvidence(workspace, {
    name: 'profile-api',
    repository,
    discovery: null,
    families,
    analysis,
  });
  await buildEvidenceIndex(workspace);
  return { workspace };
}

async function indexedQuery(): Promise<Awaited<ReturnType<typeof evidenceIndex>>> {
  const { workspace } = await indexed();
  return evidenceIndex(workspace);
}

const byText = (left: string, right: string): number => left.localeCompare(right);

describe('evidence index', () => {
  it('writes one sorted file per family, and nothing from before', async () => {
    const { workspace } = await indexed();
    const folder = path.join(workspace, 'evidence', 'profile-api');
    await writeRepositoryEvidence(workspace, {
      name: 'profile-api',
      repository,
      discovery: null,
      families: new Map([['claims', families.get('claims') ?? []]]),
      analysis: new Map(),
    });
    await expect(readdir(folder).then((names) => names.toSorted(byText))).resolves.toEqual([
      'claims.jsonl',
      'repository.json',
    ]);
    await expect(
      readdir(path.join(workspace, '.groundwork', 'analysis', 'profile-api')),
    ).resolves.toEqual([]);
    await expect(pruneEvidence(workspace, new Set())).resolves.toEqual([
      folder,
      path.join(workspace, '.groundwork', 'analysis', 'profile-api'),
    ]);
  });

  it('lists repositories with their record counts', async () => {
    const query = await indexedQuery();
    expect(query?.repositories()).toEqual([
      {
        name: 'profile-api',
        repo: repository.repo,
        commit: repository.commit,
        scannedAt: repository.scannedAt,
        language: repository.language,
        passes: repository.passes,
        records: 6,
        families: { bindings: 1, claims: 1, files: 1, framework: 1, sources: 2 },
      },
    ]);
  });

  it('finds a route by a word of its template, placed at its cited lines', async () => {
    const query = await indexedQuery();
    const found = query?.search('settin') ?? [];
    expect(found.map((row) => row.id).toSorted(byText)).toEqual([
      'aspnet:1',
      'claim:1',
      'file:Api/SettingsController.cs',
    ]);
    expect(found).toContainEqual(
      expect.objectContaining({
        id: 'aspnet:1',
        label: 'GET /v1/accounts/settings',
        path: 'Api/SettingsController.cs',
        lineStart: 10,
      }),
    );
    expect(query?.search('settin', { family: 'framework' }).map((row) => row.id)).toEqual([
      'aspnet:1',
    ]);
  });

  it('follows links both ways', async () => {
    const query = await indexedQuery();
    const route = query?.record('profile-api', 'aspnet:1');
    expect(route?.linksOut.map((link) => [link.field, link.record.id])).toEqual([
      ['source', 'source:1'],
    ]);
    const source = query?.record('profile-api', 'source:1');
    expect(source?.linksIn.map((link) => link.record.id)).toEqual(['aspnet:1']);
    expect(route?.linksIn.map((link) => [link.field, link.record.id])).toEqual([
      ['owner', 'binding:1'],
    ]);
    expect(query?.record('profile-api', 'missing')).toBeNull();
  });

  it('pages records by family and by file', async () => {
    const query = await indexedQuery();
    expect(query?.records('profile-api', { family: 'claims' }).map((row) => row.id)).toEqual([
      'claim:1',
    ]);
    const inFile = query?.records('profile-api', { path: 'Api/SettingsController.cs' });
    expect(inFile?.map((row) => row.id)).toEqual([
      'file:Api/SettingsController.cs',
      'source:1',
      'aspnet:1',
      'source:2',
      'binding:1',
    ]);
  });

  it('has no index for a workspace never indexed', async () => {
    const workspace = await scratchWorkspace();
    await expect(evidenceIndex(workspace)).resolves.toBeNull();
  });
});
