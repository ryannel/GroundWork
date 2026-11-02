import { link, lstat, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  readRepositoryPass,
  passArtifactDigest,
  saveRepositoryPassState,
} from '@/infrastructure/scan/repository-pass-files';
import type {
  RepositoryPassPlan,
  RepositoryPassState,
} from '@/infrastructure/scan/repository-pass-state';

import { checkpointDigest, verifyAdoptionSource } from './scan-repository-adopt-checker';
import { copyRetainedAncillary } from './scan-repository-adopt-retention';
import { publishRepositoryPassReport } from './scan-repository-pass-publication';

interface AdoptionPaths {
  readonly source: string;
  readonly output: string;
  readonly cloneRoot: string;
  readonly checker: string;
}
interface AdoptionContext extends AdoptionPaths {
  readonly plan: RepositoryPassPlan;
  readonly state: RepositoryPassState;
}
function argument(args: readonly string[], index: number): string {
  const value = args[index];
  if (value === undefined || value.length === 0) {
    throw new Error('Adoption arguments must be non-empty paths.');
  }
  return path.resolve(value);
}
function argumentsOf(args: readonly string[]): AdoptionPaths {
  if (args.length !== 4) {
    throw new Error(
      'Usage: scan:adopt <completed-source> <NEW-output> <clone-root> <original-immutable-scanner>',
    );
  }
  const paths = {
    source: argument(args, 0),
    output: argument(args, 1),
    cloneRoot: argument(args, 2),
    checker: argument(args, 3),
  };
  if (paths.output === paths.source || paths.output.startsWith(`${paths.source}${path.sep}`)) {
    throw new Error('Adoption output must be separate from original source.');
  }
  return paths;
}
async function copyFile(source: string, output: string): Promise<void> {
  const stat = await lstat(source);
  if (!stat.isFile() || stat.size > 64 * 1024 * 1024) {
    throw new Error('Adoption artifact is not a bounded regular file.');
  }
  await link(source, output);
}
async function copyDirectory(source: string, output: string): Promise<void> {
  const sourceDirectory = await lstat(source);
  if (!sourceDirectory.isDirectory()) {
    throw new Error('Adoption directory is not a regular directory.');
  }
  await mkdir(output);
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(output, entry.name);
    await (entry.isDirectory() ? copyDirectory(from, to) : copyFile(from, to));
  }
}
async function copyCheckpoint(input: AdoptionContext): Promise<void> {
  await mkdir(path.dirname(input.output), { recursive: true });
  await mkdir(input.output);
  for (const name of ['run-plan.json', 'inventory.json']) {
    await copyFile(path.join(input.source, name), path.join(input.output, name));
  }
  for (const scope of input.plan.scopes) {
    const target = path.join(input.output, scope.id);
    await mkdir(target);
    await copyFile(
      path.join(input.source, scope.id, 'scope.json'),
      path.join(target, 'scope.json'),
    );
  }
  for (const task of input.state.completed) {
    await copyDirectory(
      path.join(input.source, task.scope, task.attempt),
      path.join(input.output, task.scope, task.attempt),
    );
  }
  await copyRetainedAncillary(input);
}
async function publishCopiedPass(input: AdoptionContext): Promise<string> {
  const staged: RepositoryPassState = {
    ...input.state,
    status: 'stopped',
    reportDigest: null,
    failure: null,
  };
  await saveRepositoryPassState(input.output, staged);
  await readRepositoryPass(input.output);
  const reportDigest = await publishRepositoryPassReport({
    run: {
      repo: input.plan.repo,
      cloneRoot: input.cloneRoot,
      output: input.output,
      shardSize: input.plan.shardSize,
    },
    plan: input.plan,
    state: staged,
  });
  const adopted = await readRepositoryPass(input.output);
  verifyAdoptionSource({
    source: input.output,
    cloneRoot: input.cloneRoot,
    checker: input.checker,
    ...adopted,
  });
  if ((await passArtifactDigest(input.output, 'repository.json')) !== reportDigest) {
    throw new Error('Adopted repository manifest changed after verification.');
  }
  return reportDigest;
}

/** Publish verified completed native artefacts without re-extracting or relabelling their analyser. */
export async function adoptRepositoryPass(args: readonly string[]): Promise<void> {
  const paths = argumentsOf(args);
  const loaded = await readRepositoryPass(paths.source);
  const input = { ...paths, ...loaded };
  if (input.state.completed.length !== input.plan.scopes.length) {
    throw new Error('Cannot adopt an incomplete source checkpoint.');
  }
  const verification = verifyAdoptionSource(input);
  await copyCheckpoint(input);
  if (checkpointDigest(input.source) !== verification.stateDigest) {
    throw new Error('Source checkpoint changed before adoption.');
  }
  const reportDigest = await publishCopiedPass(input);
  const receipt = {
    format: 'scan-checkpoint-adoption/v1',
    sourceVerification: verification,
    repo: input.plan.repo,
    commit: input.plan.commit,
    sourceAnalysisDigest: input.plan.analysisDigest,
    adoptedShards: input.state.completed.length,
    reportDigest,
    publisherDirectory: path.resolve(import.meta.dirname, '..'),
    qualification:
      'Exact original native artefacts hard-linked after original analyser verification. New repository/v2 publication references full committed metrics. No source fact or native analysis version was changed.',
  };
  await writeFile(
    path.join(input.output, 'adoption.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { flag: 'wx' },
  );
  await saveRepositoryPassState(input.output, {
    ...input.state,
    status: 'source_complete',
    reportDigest,
    failure: null,
  });
  console.log(
    JSON.stringify({
      status: 'source_complete',
      repo: input.plan.repo,
      adoptedShards: input.state.completed.length,
      output: input.output,
    }),
  );
}
if (process.argv[1] === import.meta.filename) await adoptRepositoryPass(process.argv.slice(2));
