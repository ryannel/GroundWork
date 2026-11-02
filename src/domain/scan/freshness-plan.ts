import type { GitFileChange } from './scan.generated';

export interface FreshnessFact {
  readonly id: string;
  readonly paths: readonly string[];
  readonly dependsOn: readonly string[];
  readonly negativeSearches: readonly string[];
  readonly scope: string;
  readonly closureComplete: boolean;
}

export interface FreshnessInvalidation {
  readonly changedFilesToParse: readonly string[];
  readonly reusedFiles: readonly string[];
  readonly refreshedAnchors: readonly string[];
  readonly retiredFacts: readonly string[];
  readonly invalidatedFacts: readonly string[];
  readonly fallbackScopes: readonly string[];
}

interface InvalidationInput {
  readonly changes: readonly GitFileChange[];
  readonly facts: readonly FreshnessFact[];
  readonly forceScope?: boolean;
  readonly changedDependencies?: readonly string[];
}

function touches(path: string, scope: string): boolean {
  return scope === '' || path === scope || path.startsWith(`${scope}/`);
}

function changedPaths(changes: readonly GitFileChange[]): readonly string[] {
  return changes.flatMap((change) => [
    change.path,
    ...(change.previousPath === undefined ? [] : [change.previousPath]),
  ]);
}

const CONFIGURATION_FILES = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'go.mod',
  'go.sum',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'gradle.properties',
  'global.json',
  'NuGet.config',
]);

function configurationPath(path: string): boolean {
  const filename = path.split('/').at(-1) ?? '';
  return (
    CONFIGURATION_FILES.has(filename) ||
    /\.(?:csproj|props|targets|slnx?)$/u.test(filename) ||
    /^(?:tsconfig.*\.json|.*\.schema\.json|application(?:-[\w-]+)?\.(?:ya?ml|properties))$/u.test(
      filename,
    )
  );
}

function initiallyInvalid(fact: FreshnessFact, input: InvalidationInput): boolean {
  if (input.forceScope === true) return true;
  if (fact.dependsOn.some((id) => input.changedDependencies?.includes(id) === true)) return true;
  if (input.changes.some((change) => configurationPath(change.path))) return true;
  const paths = changedPaths(input.changes);
  if (fact.paths.some((path) => paths.includes(path))) return true;
  return fact.negativeSearches.some((scope) => paths.some((path) => touches(path, scope)));
}

function dependencyClosure(
  facts: readonly FreshnessFact[],
  seeds: readonly string[],
): readonly string[] {
  const invalid = new Set(seeds);
  let added = true;
  while (added) {
    added = false;
    for (const fact of facts) {
      if (invalid.has(fact.id) || !fact.dependsOn.some((id) => invalid.has(id))) continue;
      invalid.add(fact.id);
      added = true;
    }
  }
  return [...invalid].toSorted((left, right) => left.localeCompare(right));
}

/** Changed blobs and dependent semantics are deliberately separate units of work. */
export function planFreshnessInvalidation(input: InvalidationInput): FreshnessInvalidation {
  const paths = changedPaths(input.changes);
  const fallbackScopes = [
    ...new Set(
      input.facts
        .filter(
          (fact) =>
            !fact.closureComplete &&
            (paths.length > 0 || (input.changedDependencies?.length ?? 0) > 0),
        )
        .map((fact) => fact.scope),
    ),
  ];
  const seeds = input.facts
    .filter(
      (fact) =>
        initiallyInvalid(fact, input) || fallbackScopes.some((scope) => touches(fact.scope, scope)),
    )
    .map((fact) => fact.id);
  const invalidatedFacts = dependencyClosure(input.facts, seeds);
  const reusedRenames = input.changes.filter(
    (change) =>
      change.status === 'renamed' &&
      change.oldBlob !== undefined &&
      change.oldBlob === change.newBlob,
  );
  const retiredPaths = new Set(
    input.changes.filter((change) => change.status === 'deleted').map((change) => change.path),
  );
  return {
    changedFilesToParse: input.changes
      .filter(
        (change) =>
          change.status !== 'deleted' && change.gitlink !== true && !reusedRenames.includes(change),
      )
      .map((change) => change.path),
    reusedFiles: [
      ...new Set(input.facts.flatMap((fact) => fact.paths).filter((path) => !paths.includes(path))),
    ],
    refreshedAnchors: reusedRenames.map((change) => change.path),
    retiredFacts: input.facts
      .filter((fact) => fact.paths.length > 0 && fact.paths.every((path) => retiredPaths.has(path)))
      .map((fact) => fact.id),
    invalidatedFacts,
    fallbackScopes,
  };
}
