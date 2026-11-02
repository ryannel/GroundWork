import { parseScanScope, type ScanScope } from '@/infrastructure/scan/scan-scope';

import type { RepositoryFile, repositoryInventory } from './scan-repository-inventory';
import { repositoryScopes } from './scan-repository-scope';

interface DeltaInput {
  readonly inventory: ReturnType<typeof repositoryInventory>;
  readonly repo: string;
  readonly workspace: string;
  readonly shardSize: number;
  readonly previousScopes?: readonly ScanScope[];
  readonly previousInventory?: readonly RepositoryFile[];
}
interface Rename {
  readonly previousPath: string;
  readonly path: string;
}
export interface RepositoryDelta {
  readonly scopes: readonly ScanScope[];
  readonly changes: {
    readonly added: readonly string[];
    readonly modified: readonly string[];
    readonly deleted: readonly string[];
    readonly renamed: readonly Rename[];
    readonly unchanged: readonly string[];
  };
  readonly retiredScopeIds: readonly string[];
}
function filesByPath(files: readonly RepositoryFile[]): ReadonlyMap<string, RepositoryFile> {
  const result = new Map(files.map((file) => [file.path, file]));
  if (result.size !== files.length) throw new Error('Duplicate inventory path.');
  for (const file of files) {
    if (file.selectedForParsing !== (file.language !== null)) {
      throw new Error('Inconsistent source selection metadata.');
    }
  }
  return result;
}
function identity(file: RepositoryFile): string {
  return JSON.stringify([file.blob, file.mode, file.kind, file.language, file.selectedForParsing]);
}
function byIdentity(
  files: readonly RepositoryFile[],
): ReadonlyMap<string, readonly RepositoryFile[]> {
  const groups = new Map<string, RepositoryFile[]>();
  for (const file of files) {
    const key = identity(file);
    const group = groups.get(key) ?? [];
    group.push(file);
    groups.set(key, group);
  }
  return groups;
}
function uniqueRenames(
  removed: readonly RepositoryFile[],
  added: readonly RepositoryFile[],
): readonly Rename[] {
  const oldGroups = byIdentity(removed);
  const newGroups = byIdentity(added);
  return removed.flatMap((previous) => {
    const key = identity(previous);
    const oldMatches = oldGroups.get(key) ?? [];
    const newMatches = newGroups.get(key) ?? [];
    return oldMatches.length === 1 && newMatches.length === 1 && newMatches[0] !== undefined
      ? [{ previousPath: previous.path, path: newMatches[0].path }]
      : [];
  });
}
function changes(
  before: ReadonlyMap<string, RepositoryFile>,
  after: ReadonlyMap<string, RepositoryFile>,
): RepositoryDelta['changes'] {
  const removed = [...before.values()].filter((file) => !after.has(file.path));
  const added = [...after.values()].filter((file) => !before.has(file.path));
  const renamed = uniqueRenames(removed, added).toSorted((left, right) =>
    left.previousPath.localeCompare(right.previousPath),
  );
  const oldNames = new Set(renamed.map((rename) => rename.previousPath));
  const newNames = new Set(renamed.map((rename) => rename.path));
  const common = [...after.values()].filter((file) => before.has(file.path));
  const same = (file: RepositoryFile): boolean => {
    const previous = before.get(file.path);
    return previous !== undefined && identity(previous) === identity(file);
  };
  const paths = (files: readonly RepositoryFile[]): readonly string[] =>
    files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right));
  return {
    added: paths(added.filter((file) => !newNames.has(file.path))),
    deleted: paths(removed.filter((file) => !oldNames.has(file.path))),
    modified: paths(common.filter((file) => !same(file))),
    unchanged: paths(common.filter(same)),
    renamed,
  };
}
function scopeNumber(scope: ScanScope): number {
  const number = /^repository-(\d+)$/u.exec(scope.id)?.[1];
  const value = Number(number);
  if (number === undefined || !Number.isSafeInteger(value) || value < 1) {
    throw new Error('Expected a numbered repository scope.');
  }
  return value;
}
function previousMembership(
  scope: ScanScope,
  previous: ReadonlyMap<string, RepositoryFile>,
  paths: ReadonlySet<string>,
): readonly string[] {
  for (const file of scope.files) {
    if (paths.has(file.path) || previous.get(file.path)?.language !== file.language) {
      throw new Error('Previous scope source membership mismatch.');
    }
    if (scope.questions.filter((question) => question.path === file.path).length !== 1) {
      throw new Error('Expected one investigation question per previous file.');
    }
  }
  return scope.files.map((file) => file.path);
}
function validatePrevious(
  input: DeltaInput,
  previous: ReadonlyMap<string, RepositoryFile>,
): readonly ScanScope[] {
  const scopes = (input.previousScopes ?? []).map((scope) => parseScanScope(scope));
  const ids = new Set<string>();
  const numbers = new Set<number>();
  const paths = new Set<string>();
  const commits = new Set(scopes.map((scope) => scope.commit));
  if (commits.size > 1) throw new Error('Previous scopes must share one pinned commit.');
  for (const scope of scopes) {
    const ordinal = scopeNumber(scope);
    if (numbers.has(ordinal)) throw new Error('Duplicate repository scope number.');
    numbers.add(ordinal);
    if (scope.repo !== input.repo || scope.workspace !== input.workspace || ids.has(scope.id)) {
      throw new Error('Previous scope authority or identity mismatch.');
    }
    ids.add(scope.id);
    for (const filename of previousMembership(scope, previous, paths)) paths.add(filename);
  }
  const selected = [...previous.values()].filter((file) => file.selectedForParsing);
  if (selected.length !== paths.size || selected.some((file) => !paths.has(file.path))) {
    throw new Error('Previous scopes omit selected inventory files.');
  }
  return scopes.toSorted((left, right) => scopeNumber(left) - scopeNumber(right));
}
function retainedScope(
  input: DeltaInput,
  previous: ScanScope,
  state: {
    readonly after: ReadonlyMap<string, RepositoryFile>;
    readonly renames: ReadonlyMap<string, string>;
  },
): ScanScope | null {
  const { after, renames } = state;
  const files = previous.files.flatMap((file) => {
    const filename = renames.get(file.path) ?? file.path;
    const current = after.get(filename);
    return current?.selectedForParsing === true && current.language !== null
      ? [{ ...file, path: filename, language: current.language }]
      : [];
  });
  if (files.length === 0) return null;
  if (files.length > input.shardSize) {
    throw new Error('Retained scope exceeds configured shard size; do not silently rechunk.');
  }
  const currentFiles = files.flatMap((file) => {
    const current = after.get(file.path);
    return current ? [current] : [];
  });
  const templates =
    repositoryScopes({
      ...input.inventory,
      files: currentFiles,
      repo: input.repo,
      workspace: input.workspace,
      shardSize: input.shardSize,
    })[0]?.questions ?? [];
  const questions = templates.map((question) => {
    const original = previous.questions.find(
      (entry) => (renames.get(entry.path) ?? entry.path) === question.path,
    );
    return { ...question, id: original?.id ?? question.id };
  });
  return parseScanScope({ ...previous, commit: input.inventory.commit, files, questions });
}
function appendScopes(
  input: DeltaInput,
  files: readonly RepositoryFile[],
  maximum: number,
): readonly ScanScope[] {
  if (files.length === 0) return [];
  if (!Number.isSafeInteger(maximum + Math.ceil(files.length / input.shardSize))) {
    throw new TypeError('Repository scope number exceeds the safe range.');
  }
  return repositoryScopes({
    ...input.inventory,
    files,
    repo: input.repo,
    workspace: input.workspace,
    shardSize: input.shardSize,
  }).map((scope, index) =>
    parseScanScope({ ...scope, id: `repository-${String(maximum + index + 1).padStart(4, '0')}` }),
  );
}

/** Whole-tree delta; retained memberships do not move when sorted source paths are inserted/deleted. */
export function repositoryDeltaScopes(input: DeltaInput): RepositoryDelta {
  if (!Number.isInteger(input.shardSize) || input.shardSize < 1 || input.shardSize > 100) {
    throw new Error('Shard size must be an integer from 1 to 100.');
  }
  if ((input.previousScopes === undefined) !== (input.previousInventory === undefined)) {
    throw new Error('Previous scopes and inventory must be supplied together.');
  }
  const before = filesByPath(input.previousInventory ?? []);
  const after = filesByPath(input.inventory.files);
  const delta = changes(before, after);
  const previous = validatePrevious(input, before);
  const renames = new Map(delta.renamed.map((rename) => [rename.previousPath, rename.path]));
  const retained = previous.flatMap((scope) => {
    const updated = retainedScope(input, scope, { after, renames });
    return updated === null ? [] : [updated];
  });
  const selected = new Set(retained.flatMap((scope) => scope.files.map((file) => file.path)));
  const added = [...after.values()]
    .filter((file) => file.selectedForParsing && !selected.has(file.path))
    .toSorted((left, right) => left.path.localeCompare(right.path));
  const maximum = Math.max(0, ...previous.map(scopeNumber));
  const appended = appendScopes(input, added, maximum);
  const currentIds = new Set(retained.map((scope) => scope.id));
  return {
    scopes: [...retained, ...appended],
    changes: delta,
    retiredScopeIds: previous
      .filter((scope) => !currentIds.has(scope.id))
      .map((scope) => scope.id)
      .toSorted((left, right) => left.localeCompare(right)),
  };
}
