import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { retainAncillary } from './scan-repository-ancillary';
import { repositoryInventory } from './scan-repository-inventory';
import { repositoryScopes } from './scan-repository-scope';
import { repositoryTrial } from './scan-repository-trial';

const USAGE =
  'Usage: scan:repository <organisation/repository> <clone-root> <NEW-output> [--commit full-sha] [--workspace id] [--shard-size 40] [--cache directory] [--java executable] [--go executable]';

function argumentsOf(args: readonly string[]) {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      commit: { type: 'string' },
      workspace: { type: 'string' },
      'shard-size': { type: 'string' },
      cache: { type: 'string' },
      java: { type: 'string' },
      go: { type: 'string' },
    },
  });
  const [repo, cloneRoot, output] = positionals;
  if (
    repo === undefined ||
    cloneRoot === undefined ||
    output === undefined ||
    positionals.length !== 3
  ) {
    throw new Error(USAGE);
  }
  if (
    !/^[\w.-]+\/[\w.-]+$/u.test(repo) ||
    repo.split('/').some((part) => part === '.' || part === '..')
  ) {
    throw new Error('Expected an organisation/repository identity.');
  }
  if (values.commit !== undefined && !/^[a-f\d]{40,64}$/u.test(values.commit)) {
    throw new Error('--commit requires a full Git commit id.');
  }
  return { values, repo, cloneRoot, output };
}

async function jsonFile(filename: string, value: unknown): Promise<void> {
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

async function cacheMode(directory: string): Promise<'empty' | 'reused_source_index'> {
  try {
    const entries = await readdir(directory);
    return entries.length === 0 ? 'empty' : 'reused_source_index';
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return 'empty';
    throw error;
  }
}

async function prepare(input: ReturnType<typeof argumentsOf>) {
  const inventory = repositoryInventory(
    path.join(input.cloneRoot, input.repo),
    input.values.commit,
  );
  const workspace = input.values.workspace ?? input.repo.split('/')[0] ?? input.repo;
  const scopes = repositoryScopes({
    ...inventory,
    repo: input.repo,
    workspace,
    shardSize: Number(input.values['shard-size'] ?? 40),
  });
  await mkdir(input.output);
  const cacheDirectory = path.resolve(input.values.cache ?? path.join(input.output, 'cache'));
  const initialCacheMode = await cacheMode(cacheDirectory);
  const ancillary = await retainAncillary({
    repository: path.join(input.cloneRoot, input.repo),
    output: input.output,
    files: inventory.files,
  });
  await jsonFile(path.join(input.output, 'inventory.json'), {
    format: 'scan-repository-inventory/v1',
    repo: input.repo,
    ...inventory,
    denominator: inventory.files.length,
    sourceFiles: inventory.files.filter((file) => file.category === 'source').length,
    testFiles: inventory.files.filter((file) => file.category === 'test').length,
    unparsedFiles: inventory.files.filter((file) => !file.selectedForParsing).length,
    ancillary,
    classification:
      'Source/test classification uses filename and Git mode; ancillary bytes are separately inspected and retained as unparsed text or explicitly excluded.',
    completeness:
      'Tracked tree inventory only; source selection and parser diagnostics are distinct from semantic closure.',
  });
  for (const scope of scopes) {
    await mkdir(path.join(input.output, scope.id));
    await jsonFile(path.join(input.output, scope.id, 'scope.json'), scope);
  }
  return { inventory, scopes, workspace, cacheDirectory, cacheMode: initialCacheMode };
}

async function runTrials(
  input: ReturnType<typeof argumentsOf>,
  prepared: Awaited<ReturnType<typeof prepare>>,
) {
  const reports: Awaited<ReturnType<typeof repositoryTrial>>[] = [];
  const first = prepared.cacheMode === 'empty' ? 'cold' : 'first';
  for (const trial of [first, 'warm'] as const) {
    for (const scope of prepared.scopes) {
      console.log(
        JSON.stringify({ trial, scope: scope.id, files: scope.files.length, status: 'running' }),
      );
      reports.push(
        await repositoryTrial({
          scope,
          trial,
          output: path.join(input.output, scope.id),
          options: {
            authority: prepared.workspace,
            cloneRoot: input.cloneRoot,
            cacheDirectory: prepared.cacheDirectory,
            ...(input.values.java === undefined ? {} : { java: input.values.java }),
            ...(input.values.go === undefined ? {} : { go: input.values.go }),
          },
        }),
      );
    }
  }
  return reports;
}

/** Explicit repository only; immutable shard publications retain the bounded scope contract. */
export async function scanRepository(args: readonly string[]): Promise<void> {
  const input = argumentsOf(args);
  const started = performance.now();
  const prepared = await prepare(input);
  const trials = await runTrials(input, prepared);
  const report = {
    format: 'scan-repository/v1',
    repo: input.repo,
    commit: prepared.inventory.commit,
    tree: prepared.inventory.tree,
    inventory: 'inventory.json',
    status: 'partial',
    cacheMode: prepared.cacheMode,
    cacheDirectory: prepared.cacheDirectory,
    trackedFiles: prepared.inventory.files.length,
    selectedFiles: prepared.scopes.reduce((total, scope) => total + scope.files.length, 0),
    shardCount: prepared.scopes.length,
    elapsedMs: performance.now() - started,
    trials,
    limitations: [
      'Repository tree inventory and local parsing do not establish complete contracts, endpoint behaviour or journeys.',
      'Questions are broad investigation placeholders with unresolved receipts, not accepted endpoint discoveries.',
      'Cross-shard dependencies, runtime bindings, actor intent and deployed state remain unestablished.',
      'Freshness observes local HEAD against the pinned source commit; it does not establish remote or deployed freshness.',
      'Cold means an empty source/index cache; compiler and operating system caches may already be warm.',
      'A first phase with reused_source_index uses a pre-existing cache; reuse is established by its observed read, parse and hit counts, not by that label alone.',
      'No old workflow timing or token baseline has been measured; no speedup factor can be inferred.',
    ],
  };
  await jsonFile(path.join(input.output, 'repository.json'), report);
  console.log(
    JSON.stringify({
      status: report.status,
      repo: report.repo,
      trackedFiles: report.trackedFiles,
      selectedFiles: report.selectedFiles,
      shards: report.shardCount,
      elapsedMs: report.elapsedMs,
    }),
  );
}

if (process.argv[1] === import.meta.filename) {
  await scanRepository(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
