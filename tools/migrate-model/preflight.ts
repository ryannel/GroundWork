import { modelProblems } from '@/infrastructure/model-schema';

import type { MigratedWorkspace } from './workspace';

export interface MigrationProblem {
  readonly file: string;
  readonly path: string;
  readonly keyword: string;
  readonly message: string;
  readonly detail: unknown;
}
export async function migrationProblems(
  workspace: MigratedWorkspace,
): Promise<readonly MigrationProblem[]> {
  const problems: MigrationProblem[] = [];
  for (const [file, fragment] of workspace.files) {
    if (fragment.family === null) continue;
    const errors =
      fragment.family === 'workspace'
        ? await modelProblems('workspace', fragment.definition, fragment.value)
        : await modelProblems('plan', 'document', fragment.value);
    problems.push(
      ...errors.map((error) => ({
        file,
        path: error.path,
        keyword: error.keyword,
        message: error.message,
        detail: { schema: error.schemaPath, params: error.params },
      })),
    );
  }
  return problems;
}

export function migrationSummary(
  problems: readonly MigrationProblem[],
): readonly Readonly<Record<string, unknown>>[] {
  const groups = new Map<
    string,
    {
      readonly count: number;
      readonly cause: unknown;
      readonly examples: readonly MigrationProblem[];
    }
  >();
  for (const problem of problems) {
    const cause = {
      path: problem.path.replaceAll(/\/\d+(?=\/|$)/gu, '/*'),
      keyword: problem.keyword,
      detail: problem.detail,
    };
    const key = JSON.stringify(cause);
    const previous = groups.get(key);
    groups.set(key, {
      cause,
      count: (previous?.count ?? 0) + 1,
      examples: [...(previous?.examples ?? []), problem].slice(0, 3),
    });
  }
  return [...groups.values()].toSorted((a, b) => b.count - a.count);
}
