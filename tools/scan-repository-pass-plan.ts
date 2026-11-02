import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  immutablePassJson,
  saveRepositoryPassState,
} from '@/infrastructure/scan/repository-pass-files';
import {
  parseRepositoryPassPlan,
  type RepositoryPassPlan,
  type RepositoryPassState,
} from '@/infrastructure/scan/repository-pass-state';
import { readRepositoryPredecessor } from '@/infrastructure/scan/repository-predecessor';
import type { ScanScope } from '@/infrastructure/scan/scan-scope';
import { scopedProvenances } from '@/infrastructure/scan/scoped-source-provenance';
import type { ScopedSourceOptions } from '@/infrastructure/scan/scoped-source-store';
import { sourceByteLimit } from '@/infrastructure/scan/source-budget';
import { sourceDigest } from '@/infrastructure/scan/source-index';

import { retainAncillary } from './scan-repository-ancillary';
import { repositoryDeltaScopes } from './scan-repository-delta';
import { repositoryInventory } from './scan-repository-inventory';

export interface PassInput {
  readonly repo: string;
  readonly cloneRoot: string;
  readonly output: string;
  readonly commit?: string | undefined;
  readonly workspace?: string | undefined;
  readonly cache?: string | undefined;
  readonly previous?: string | undefined;
  readonly java?: string | undefined;
  readonly go?: string | undefined;
  readonly shardSize: number;
  readonly maxSourceBytes?: number | undefined;
}

export function passOptions(
  plan: Pick<RepositoryPassPlan, 'workspace' | 'cacheDirectory' | 'maxSourceBytes'>,
  input: Pick<PassInput, 'cloneRoot' | 'java' | 'go'>,
): ScopedSourceOptions {
  return {
    authority: plan.workspace,
    cloneRoot: input.cloneRoot,
    cacheDirectory: plan.cacheDirectory,
    maxSourceBytes: plan.maxSourceBytes,
    ...(input.java === undefined ? {} : { java: input.java }),
    ...(input.go === undefined ? {} : { go: input.go }),
  };
}

export function passAnalysisDigest(
  plan: Pick<RepositoryPassPlan, 'workspace' | 'cacheDirectory' | 'maxSourceBytes'> & {
    readonly scopes: readonly ScanScope[];
  },
  input: Pick<PassInput, 'cloneRoot' | 'java' | 'go'>,
): string {
  const code = [
    'scan-repository-pass.ts',
    'scan-repository-pass-plan.ts',
    'scan-repository-pass-task.ts',
    'scan-repository-pass-verify.ts',
    'scan-repository-pass-args.ts',
    'scan-repository-pass-publication.ts',
    'scan-repository-pass-presence.ts',
    'scan-repository-delta.ts',
    'scan-repository-ancillary.ts',
    'scan-repository-inventory.ts',
    'scan-repository-generated.ts',
    'scan-repository-generated-config.ts',
    'scan-repository-fixtures.ts',
  ].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'));
  return sourceDigest(
    JSON.stringify([code, scopedProvenances(plan.scopes, passOptions(plan, input))]),
  );
}

async function writePrepared(
  directory: string,
  plan: RepositoryPassPlan,
  inventory: unknown,
): Promise<void> {
  await immutablePassJson(path.join(directory, 'inventory.json'), inventory);
  await immutablePassJson(path.join(directory, 'run-plan.json'), plan);
  await Promise.all(
    plan.scopes.map(async (scope) => {
      await mkdir(path.join(directory, scope.id));
      await immutablePassJson(path.join(directory, scope.id, 'scope.json'), scope);
    }),
  );
}

async function previousFor(
  input: PassInput,
): Promise<Awaited<ReturnType<typeof readRepositoryPredecessor>> | undefined> {
  const previous =
    input.previous === undefined ? undefined : await readRepositoryPredecessor(input.previous);
  if (previous && previous.repo !== input.repo) {
    throw new Error('Previous publication belongs to another repository.');
  }
  return previous;
}

function passWorkspace(input: PassInput, scopes: readonly ScanScope[] | undefined): string {
  return input.workspace ?? scopes?.[0]?.workspace ?? input.repo.split('/')[0] ?? input.repo;
}

async function passAncillary(
  input: PassInput,
  base: Pick<RepositoryPassPlan, 'workspace' | 'cacheDirectory'>,
  files: Parameters<typeof retainAncillary>[0]['files'],
) {
  return retainAncillary({
    repository: path.join(input.cloneRoot, input.repo),
    output: input.output,
    files,
    cacheDirectory: path.join(
      base.cacheDirectory,
      sourceDigest(JSON.stringify([base.workspace, input.repo])),
      'ancillary',
    ),
  });
}

export async function prepareRepositoryPass(
  input: PassInput,
): Promise<{ readonly plan: RepositoryPassPlan; readonly state: RepositoryPassState }> {
  const inventory = repositoryInventory(path.join(input.cloneRoot, input.repo), input.commit);
  const previous = await previousFor(input);
  const workspace = passWorkspace(input, previous?.scopes);
  const delta = repositoryDeltaScopes({
    inventory,
    repo: input.repo,
    workspace,
    shardSize: input.shardSize,
    ...(previous === undefined
      ? {}
      : { previousScopes: previous.scopes, previousInventory: previous.files }),
  });
  const base = {
    format: 'scan-pass-plan/v1' as const,
    repo: input.repo,
    workspace,
    commit: inventory.commit,
    tree: inventory.tree,
    cacheDirectory: path.resolve(
      input.cache ?? previous?.cacheDirectory ?? path.join(input.output, 'cache'),
    ),
    maxSourceBytes: sourceByteLimit(input.maxSourceBytes),
    shardSize: input.shardSize,
    scopes: delta.scopes,
    changes: delta.changes,
    retiredScopeIds: delta.retiredScopeIds,
  };
  await mkdir(input.output);
  const ancillary = await passAncillary(input, base, inventory.files);
  const inventoryReport = {
    format: 'scan-repository-inventory/v1',
    repo: input.repo,
    ...inventory,
    ancillary,
    denominator: inventory.files.length,
  };
  const plan = parseRepositoryPassPlan({
    ...base,
    inventoryDigest: sourceDigest(JSON.stringify(inventoryReport)),
    analysisDigest: passAnalysisDigest(base, input),
  });
  await writePrepared(input.output, plan, inventoryReport);
  const state: RepositoryPassState = {
    format: 'scan-pass-state/v1',
    planDigest: sourceDigest(JSON.stringify(plan)),
    status: 'prepared',
    completed: [],
    failure: null,
    reportDigest: null,
  };
  await saveRepositoryPassState(input.output, state);
  return { plan, state };
}
