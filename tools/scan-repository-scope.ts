import { parseScanScope, type ScanScope, type ScopeFile } from '@/infrastructure/scan/scan-scope';

import type { RepositoryFile } from './scan-repository-inventory';

interface RepositoryScope {
  readonly repo: string;
  readonly workspace: string;
  readonly commit: string;
  readonly files: readonly RepositoryFile[];
  readonly shardSize: number;
}

function selectedFile(file: RepositoryFile): ScopeFile {
  if (file.language === null) throw new Error('Cannot select an unsupported source language.');
  return { path: file.path, language: file.language, environment: 'unknown' };
}

function question(file: ScopeFile, index: number) {
  return {
    id: `investigate-${String(index + 1)}`,
    profile: 'endpoint',
    path: file.path,
    symbol: '',
    checks: [
      {
        kind: 'investigation',
        text: 'Investigate entry points, reachable control and values, contracts, effects and unresolved dependencies. File selection does not establish an endpoint or semantic closure.',
      },
    ],
  };
}

/** Every supported file occurs once. Scope identities are stable across warm trials. */
export function repositoryScopes(input: RepositoryScope): readonly ScanScope[] {
  if (!Number.isInteger(input.shardSize) || input.shardSize < 1 || input.shardSize > 100) {
    throw new Error('Shard size must be an integer from 1 to 100.');
  }
  const selected = input.files.filter((file) => file.language !== null).map(selectedFile);
  const scopes: ScanScope[] = [];
  for (let offset = 0; offset < selected.length; offset += input.shardSize) {
    const files = selected.slice(offset, offset + input.shardSize);
    scopes.push(
      parseScanScope({
        format: 'scan-scope/v1',
        workspace: input.workspace,
        repo: input.repo,
        id: `repository-${String(scopes.length + 1).padStart(4, '0')}`,
        commit: input.commit,
        ref: 'HEAD',
        files,
        questions: files.map(question),
      }),
    );
  }
  if (scopes.length === 0) throw new Error('The pinned repository has no supported source files.');
  return scopes;
}
