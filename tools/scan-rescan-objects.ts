import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseRescanRoster } from '@/infrastructure/scan/rescan-preflight-input';

import { repositoryInventory } from './scan-repository-inventory';

function inventoryAt(input: {
  readonly cloneRoot: string;
  readonly repo: string;
  readonly commit: string;
  readonly fallbackRoot: string | undefined;
}) {
  let clone = path.join(input.cloneRoot, input.repo);
  try {
    return { clone, inventory: repositoryInventory(clone, input.commit) };
  } catch (error) {
    if (input.fallbackRoot === undefined) throw error;
    clone = path.join(input.fallbackRoot, input.repo.split('/').at(-1) ?? '');
    return { clone, inventory: repositoryInventory(clone, input.commit) };
  }
}
function objectHeaders(
  clone: string,
  ids: readonly string[],
): readonly { readonly id: string; readonly type: string; readonly size: number | null }[] {
  const raw = execFileSync(
    '/usr/bin/git',
    [
      '--no-optional-locks',
      '-C',
      clone,
      'cat-file',
      '--batch-check=%(objectname) %(objecttype) %(objectsize)',
    ],
    {
      input: `${ids.join('\n')}\n`,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 32 * 1024 * 1024,
      env: { NODE_ENV: 'production', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const lines = raw.trim().split('\n');
  if (lines.length !== ids.length) throw new Error('Incomplete object-header batch');
  return lines.map((line, index) => {
    const [id, type, size] = line.split(' ');
    if (id === undefined || id !== ids[index] || type === undefined) {
      throw new Error('Object-header identity mismatch');
    }
    const bytes = type === 'missing' ? null : Number(size);
    if (bytes !== null && !Number.isSafeInteger(bytes)) {
      throw new Error('Invalid object-header size');
    }
    return { id, type, size: bytes };
  });
}
function repositoryObjects(input: {
  readonly cloneRoot: string;
  readonly repo: string;
  readonly commit: string;
  readonly fallbackRoot: string | undefined;
}) {
  try {
    const { clone, inventory } = inventoryAt(input);
    const blobs = inventory.files.filter((file) => file.kind === 'blob');
    const ids = [
      ...new Set([inventory.commit, inventory.tree, ...blobs.map((file) => file.blob)]),
    ].toSorted((left, right) => left.localeCompare(right));
    const headers = objectHeaders(clone, ids);
    const expected = new Map([
      [inventory.commit, 'commit'],
      [inventory.tree, 'tree'],
      ...blobs.map((file) => [file.blob, 'blob'] as const),
    ]);
    const failures = headers
      .filter((header) => header.type !== expected.get(header.id))
      .map((header) => ({
        ...header,
        paths: blobs.filter((file) => file.blob === header.id).map((file) => file.path),
      }));
    return {
      repo: input.repo,
      commit: inventory.commit,
      tree: inventory.tree,
      clone,
      status:
        failures.length === 0
          ? 'local_object_headers_available'
          : 'missing_or_invalid_local_objects',
      trackedEntries: inventory.files.length,
      trackedBlobPaths: blobs.length,
      checkedUniqueHeaders: headers.length,
      metadataSha256: createHash('sha256').update(JSON.stringify(headers)).digest('hex'),
      failures,
      externalGitlinks: inventory.files
        .filter((file) => file.kind === 'commit')
        .map((file) => ({
          path: file.path,
          commit: file.blob,
          status: 'external_child_source_unexamined',
        })),
    };
  } catch (error) {
    return {
      repo: input.repo,
      commit: input.commit,
      status: 'metadata_unavailable',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
/** Object names/types/sizes only: no blob body reads, parser calls, target builds or network. */
export async function scanRescanObjects(args: readonly string[]): Promise<void> {
  const [manifest, cloneRoot, output, fallbackRoot] = args;
  const validLength = args.length === 3 || args.length === 4;
  if (manifest === undefined || cloneRoot === undefined || output === undefined || !validLength) {
    throw new Error(
      'Usage: scan-rescan-objects <scan-state.json> <clone-root> <NEW-report.json> [fallback-flat-clone-root]',
    );
  }
  const bytes = await readFile(manifest, 'utf8');
  const roster = parseRescanRoster(JSON.parse(bytes));
  const repositories = roster.repositories.map((repository) =>
    repositoryObjects({ ...repository, cloneRoot, fallbackRoot }),
  );
  const report = {
    format: 'rescan-object-availability/v1',
    status: repositories.every(
      (repository) => repository.status === 'local_object_headers_available',
    )
      ? 'all_declared_parent_repository_object_headers_available'
      : 'local_object_availability_blocked',
    rosterSha256: createHash('sha256').update(bytes).digest('hex'),
    repositoryCount: repositories.length,
    qualification:
      'Pinned local Git object metadata only. Blob bodies/content hashes, semantic completeness, gitlink child source and remote/deployed freshness are not verified. No lazy fetch or network.',
    repositories,
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
}
if (process.argv[1] === import.meta.filename) await scanRescanObjects(process.argv.slice(2));
