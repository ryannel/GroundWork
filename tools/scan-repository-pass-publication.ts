import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  immutablePassJson,
  passArtifactDigest,
  readRepositoryPass,
  repositoryPassJson,
} from '@/infrastructure/scan/repository-pass-files';
import type {
  RepositoryPassPlan,
  RepositoryPassState,
} from '@/infrastructure/scan/repository-pass-state';
import {
  repositoryTrialReference,
  type RepositoryTrialReference,
} from '@/infrastructure/scan/repository-trial-reference';
import { sourceDigest } from '@/infrastructure/scan/source-index';

import type { repositoryPassArguments } from './scan-repository-pass-args';
import { passAnalysisDigest, type PassInput } from './scan-repository-pass-plan';
import { passFileExists } from './scan-repository-pass-presence';
import { verifyPassPublications } from './scan-repository-pass-verify';

const INVENTORY = 'inventory.json';
const REPORT = 'repository.json';

export async function resumeRepositoryPass(
  input: ReturnType<typeof repositoryPassArguments>,
): Promise<{ readonly plan: RepositoryPassPlan; readonly state: RepositoryPassState }> {
  const loaded = await readRepositoryPass(input.run.output);
  const { plan, state } = loaded;
  const supplied = input.values;
  const mismatch = [
    plan.repo !== input.run.repo,
    supplied.commit !== undefined && supplied.commit !== plan.commit,
    supplied.workspace !== undefined && supplied.workspace !== plan.workspace,
    supplied.cache !== undefined && path.resolve(supplied.cache) !== plan.cacheDirectory,
    supplied['shard-size'] !== undefined && Number(supplied['shard-size']) !== plan.shardSize,
    supplied['max-source-bytes'] !== undefined &&
      Number(supplied['max-source-bytes']) !== plan.maxSourceBytes,
    passAnalysisDigest(plan, input.run) !== plan.analysisDigest,
  ].some(Boolean);
  if (mismatch) {
    throw new Error(
      'Resume pin, selection, policy or analysis changed. Start a new immutable run.',
    );
  }
  const inventory = await repositoryPassJson(path.join(input.run.output, INVENTORY));
  if (sourceDigest(JSON.stringify(inventory)) !== plan.inventoryDigest) {
    throw new Error('Pinned inventory changed after preparation.');
  }
  if (
    state.status === 'source_complete' &&
    (await passArtifactDigest(input.run.output, REPORT)) !== state.reportDigest
  ) {
    throw new Error('Completed repository report changed.');
  }
  await verifyPassPublications({ ...loaded, run: input.run });
  return loaded;
}

export async function publishRepositoryPassReport(input: {
  readonly run: PassInput;
  readonly plan: RepositoryPassPlan;
  readonly state: RepositoryPassState;
}): Promise<string> {
  const { plan, run, state } = input;
  if (state.completed.length !== plan.scopes.length) {
    throw new Error('Cannot publish an incomplete source pass.');
  }
  const trials: RepositoryTrialReference[] = [];
  for (const task of state.completed) {
    const metrics = await repositoryPassJson(path.join(run.output, task.metrics));
    const digest = await passArtifactDigest(run.output, task.metrics);
    trials.push(repositoryTrialReference(task, metrics, digest));
  }

  const inventory = await repositoryPassJson(path.join(run.output, INVENTORY));
  const trackedFiles = isInventory(inventory) ? inventory.files.length : 0;
  const expected = {
    format: 'scan-repository/v2',
    repo: plan.repo,
    commit: plan.commit,
    tree: plan.tree,
    inventory: INVENTORY,
    status: 'partial',
    runStatus: 'source_complete',
    planDigest: state.planDigest,
    cacheMode: 'observed_per_task',
    cacheDirectory: plan.cacheDirectory,
    shardCount: plan.scopes.length,
    trackedFiles,
    selectedFiles: plan.scopes.reduce((total, scope) => total + scope.files.length, 0),
    trials,
    sourcePolicy: { maxSourceBytes: plan.maxSourceBytes, shardSize: plan.shardSize },
    changes: plan.changes,
    retiredScopeIds: plan.retiredScopeIds,
    modelCalls: 0,
    modelTokens: 0,
    modelUsageScope: 'deterministic_source_phase',
    interpretation: { status: 'pending', required: true },
    semanticAcceptance: 'not_established',
    widerScans: 'stopped',
  };
  const filename = path.join(run.output, REPORT);
  if (await passFileExists(filename)) {
    if (!isDeepStrictEqual(await repositoryPassJson(filename), expected)) {
      throw new Error('An incompatible aggregate already exists.');
    }
  } else await immutablePassJson(filename, expected);
  return passArtifactDigest(run.output, REPORT);
}

function isInventory(value: unknown): value is { readonly files: readonly unknown[] } {
  return (
    typeof value === 'object' && value !== null && 'files' in value && Array.isArray(value.files)
  );
}
