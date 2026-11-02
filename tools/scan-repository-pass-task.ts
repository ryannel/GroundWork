import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { immutablePassJson, passArtifactDigest } from '@/infrastructure/scan/repository-pass-files';
import type {
  RepositoryPassPlan,
  RepositoryPassTask,
} from '@/infrastructure/scan/repository-pass-state';
import type { ScanScope } from '@/infrastructure/scan/scan-scope';

import { passOptions, type PassInput } from './scan-repository-pass-plan';
import { repositoryTrial } from './scan-repository-trial';

/** Incomplete attempts are never adopted: a retry uses the content cache and a new attempt directory. */
export async function runRepositoryPassTask(input: {
  readonly plan: RepositoryPassPlan;
  readonly scope: ScanScope;
  readonly run: PassInput;
}): Promise<RepositoryPassTask> {
  const attempt = `attempt-${randomUUID()}`;
  const relative = `${input.scope.id}/${attempt}`;
  const output = path.join(input.run.output, relative);
  await mkdir(output);
  const result = await repositoryTrial({
    scope: input.scope,
    output,
    trial: 'first',
    options: passOptions(input.plan, input.run),
  });
  const prefix = `${relative}/${result.generation}`;
  const metrics = `${relative}/completion.json`;
  await immutablePassJson(path.join(input.run.output, metrics), {
    ...result,
    document: `${prefix}/document.json`,
    coverage: `${prefix}/coverage.json`,
  });
  const files = [
    `${relative}/first-metrics.json`,
    metrics,
    ...['document', 'baseline', 'scope', 'coverage'].map((name) => `${prefix}/${name}.json`),
  ];
  const artifacts = await Promise.all(
    files.map(async (filename) => ({
      path: filename,
      digest: await passArtifactDigest(input.run.output, filename),
    })),
  );
  return { scope: input.scope.id, attempt, generation: result.generation, metrics, artifacts };
}
