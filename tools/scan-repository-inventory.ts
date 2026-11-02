import { execFileSync } from 'node:child_process';
import path from 'node:path';

import type { ScopeFile } from '@/infrastructure/scan/scan-scope';

import { canonicalDataFixtures } from './scan-repository-fixtures';
import { generatedActionBundles } from './scan-repository-generated';

export interface RepositoryFile {
  readonly path: string;
  readonly mode: string;
  readonly kind: string;
  readonly blob: string;
  readonly category: 'source' | 'test' | 'ancillary' | 'binary' | 'non-regular';
  readonly language: ScopeFile['language'] | null;
  readonly selectedForParsing: boolean;
  readonly reason: string;
  readonly canonicalData?:
    | {
        readonly classification: 'canonical_data_fixture';
        readonly canonicalTextLimitBytes: number;
        readonly commit: string;
        readonly sha256: string;
        readonly lines: readonly [number, number];
        readonly parser: string;
        readonly literalNodes: number;
        readonly storybookConfig: { readonly path: string; readonly blob: string };
        readonly contractObligation: string;
      }
    | undefined;
}

export function repositoryGit(repository: string, args: readonly string[]): Buffer {
  return execFileSync('/usr/bin/git', ['--no-optional-locks', '-C', repository, ...args], {
    env: { NODE_ENV: 'production', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30_000,
  });
}

function languageOf(filename: string): ScopeFile['language'] | null {
  if (bundledPackageManager(filename)) return null;
  const extensions: Readonly<Record<string, ScopeFile['language']>> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mts': 'typescript',
    '.cts': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.java': 'java',
    '.go': 'go',
    '.cs': 'csharp',
    '.py': 'python',
    '.pyi': 'python',
    '.rs': 'rust',
  };
  return extensions[path.extname(filename)] ?? null;
}

function bundledPackageManager(filename: string): boolean {
  return /(?:^|\/)\.yarn\/releases\/yarn-[\w.-]+\.cjs$/u.test(filename);
}

function selectionReason(filename: string, language: RepositoryFile['language']): string {
  if (bundledPackageManager(filename)) {
    return 'Bundled Yarn package-manager executable; excluded from application parsing, retained in the complete inventory and ancillary size policy.';
  }
  return language === null
    ? 'Not parsed; classification is based on Git mode and filename, not content inspection.'
    : 'Selected for the supported language adapter; parser diagnostics remain separate.';
}

function categoryOf(
  filename: string,
  language: RepositoryFile['language'],
): RepositoryFile['category'] {
  if (language !== null) {
    return filename
      .split('/')
      .some(
        (part) =>
          ['test', 'tests', '__tests__'].includes(part.toLowerCase()) ||
          /(?:^|\.)Tests$/u.test(part),
      ) ||
      /\.(?:test|spec)\.[^/]+$/u.test(filename) ||
      filename.endsWith('_test.go')
      ? 'test'
      : 'source';
  }
  return /\.(?:png|jpe?g|gif|webp|ico|pdf|jar|zip|gz|woff2?|ttf|class)$/iu.test(filename)
    ? 'binary'
    : 'ancillary';
}

function inventoryFile(record: string): RepositoryFile {
  const separator = record.indexOf('\t');
  const [mode, kind, blob] = record.slice(0, separator).split(' ');
  if (separator === -1 || mode === undefined || kind === undefined || blob === undefined) {
    throw new Error('Malformed Git tree entry.');
  }
  const filename = record.slice(separator + 1);
  const regular = kind === 'blob' && (mode === '100644' || mode === '100755');
  const language = regular ? languageOf(filename) : null;
  const category = regular ? categoryOf(filename, language) : 'non-regular';
  return {
    path: filename,
    mode,
    kind,
    blob,
    category,
    language,
    selectedForParsing: language !== null,
    reason: selectionReason(filename, language),
  };
}

/** The denominator is the complete pinned tree, independent of extractor discoveries. */
export function repositoryInventory(
  repository: string,
  revision = 'HEAD',
): { readonly commit: string; readonly tree: string; readonly files: readonly RepositoryFile[] } {
  const commit = repositoryGit(repository, [
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${revision}^{commit}`,
  ])
    .toString('utf8')
    .trim();
  const tree = repositoryGit(repository, ['rev-parse', '--verify', `${commit}^{tree}`])
    .toString('utf8')
    .trim();
  const listing = repositoryGit(repository, [
    'ls-tree',
    '-r',
    '-z',
    '--full-tree',
    commit,
  ]).toString('utf8');
  const files = listing
    .split('\0')
    .filter((record) => record !== '')
    .map(inventoryFile)
    .toSorted((left, right) => (left.path < right.path ? -1 : Number(left.path > right.path)));
  return {
    commit,
    tree,
    files: canonicalDataFixtures({
      files: generatedActionBundles({
        files,
        read: (blob, sizeOnly) =>
          repositoryGit(repository, ['cat-file', sizeOnly ? '-s' : 'blob', blob]),
      }),
      commit,
      read: (blob, sizeOnly) =>
        repositoryGit(repository, ['cat-file', sizeOnly ? '-s' : 'blob', blob]),
    }),
  };
}
