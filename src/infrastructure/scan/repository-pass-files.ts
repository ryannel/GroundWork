import 'server-only';

import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readFramedScanJson } from './framed-scan-document';
import {
  parseRepositoryPassPlan,
  parseRepositoryPassState,
  type RepositoryPassPlan,
  type RepositoryPassState,
  type RepositoryPassTask,
} from './repository-pass-state';
import { parseScanScope } from './scan-scope';
import { sourceDigest } from './source-index';

export async function repositoryPassJson(filename: string): Promise<unknown> {
  return readFramedScanJson(filename);
}

export async function immutablePassJson(filename: string, value: unknown): Promise<void> {
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

export async function saveRepositoryPassState(
  directory: string,
  value: RepositoryPassState,
): Promise<void> {
  const parsed = parseRepositoryPassState(value);
  const temporary = path.join(directory, `.state-${randomUUID()}.json`);
  await immutablePassJson(temporary, parsed);
  await rename(temporary, path.join(directory, 'run-state.json'));
}

export async function readRepositoryPass(directory: string): Promise<{
  readonly plan: RepositoryPassPlan;
  readonly state: RepositoryPassState;
}> {
  const plan = parseRepositoryPassPlan(
    await repositoryPassJson(path.join(directory, 'run-plan.json')),
  );
  const state = parseRepositoryPassState(
    await repositoryPassJson(path.join(directory, 'run-state.json')),
  );
  if (sourceDigest(JSON.stringify(plan)) !== state.planDigest) {
    throw new Error('Repository pass plan changed after pinning.');
  }
  if (
    state.status === 'source_complete' &&
    (state.completed.length !== plan.scopes.length || state.reportDigest === null)
  ) {
    throw new Error('Terminal source checkpoint is incomplete.');
  }
  await Promise.all(
    plan.scopes.map(async (scope) => {
      const stored = parseScanScope(
        await repositoryPassJson(path.join(directory, scope.id, 'scope.json')),
      );
      if (JSON.stringify(stored) !== JSON.stringify(scope)) {
        throw new Error('Prepared source scope changed after pinning.');
      }
    }),
  );
  const expected = plan.scopes.slice(0, state.completed.length).map((scope) => scope.id);
  if (JSON.stringify(expected) !== JSON.stringify(state.completed.map((task) => task.scope))) {
    throw new Error('Repository pass checkpoints do not match the pinned task order.');
  }
  await state.completed.reduce<Promise<void>>(async (previous, task) => {
    await previous;
    await verifyRepositoryPassTask(directory, task);
  }, Promise.resolve());
  return { plan, state };
}

export async function passArtifactDigest(directory: string, relative: string): Promise<string> {
  const filename = path.resolve(directory, relative);
  if (!filename.startsWith(`${path.resolve(directory)}${path.sep}`)) {
    throw new Error('Pass artifact leaves its output directory.');
  }
  await repositoryPassJson(filename);
  return sourceDigest(await readFile(filename, 'utf8'));
}

export async function verifyRepositoryPassTask(
  directory: string,
  task: RepositoryPassTask,
): Promise<void> {
  const root = `${task.scope}/${task.attempt}`;
  const expected = [
    `${root}/first-metrics.json`,
    `${root}/completion.json`,
    ...['document', 'baseline', 'scope', 'coverage'].map(
      (name) => `${root}/${task.generation}/${name}.json`,
    ),
  ].toSorted((left, right) => left.localeCompare(right));
  if (
    JSON.stringify(
      task.artifacts
        .map((entry) => entry.path)
        .toSorted((left, right) => left.localeCompare(right)),
    ) !== JSON.stringify(expected) ||
    task.metrics !== `${root}/completion.json`
  ) {
    throw new Error('Repository task artifact set is incomplete or outside its pinned attempt.');
  }
  const digests = await Promise.all(
    task.artifacts.map(async (artifact) => passArtifactDigest(directory, artifact.path)),
  );
  if (task.artifacts.some((artifact, position) => artifact.digest !== digests[position])) {
    throw new Error('Repository task artifact changed after checkpoint.');
  }
}
