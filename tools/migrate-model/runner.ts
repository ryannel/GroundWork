import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { cp, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';

import { indexOf } from '@/application/model-index';
import { modelRecord, modelText } from '@/domain/workspace-model';
import { readModelPlans } from '@/infrastructure/model-plans';
import { modelValidator } from '@/infrastructure/model-schema';
import { readModel } from '@/infrastructure/read-model';
import { validateModel, validatePlanProjection } from '@/infrastructure/validate-model';
import { workspaceFolder } from '@/infrastructure/workspace-folders';

import { migrateEvidence } from './evidence';
import { authoredFiles, writeMigrationFile, writeReviews } from './files';
import { migrationProblems, migrationSummary } from './preflight';
import { fingerprint, migrationReview, reviewSummary } from './review';
import { migrateWorkspace, type MigratedWorkspace } from './workspace';

export interface MigrationOptions {
  readonly workspace: string;
  readonly out: string;
  readonly report: string;
  readonly accepted?: readonly unknown[];
}
function within(folder: string, file: string): boolean {
  const relative = path.relative(folder, file);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
async function newOutput(
  options: MigrationOptions,
): Promise<{ readonly source: string; readonly out: string; readonly report: string }> {
  const source = await realpath(options.workspace);
  const out = path.resolve(options.out);
  const report = path.resolve(options.report);
  if (within(source, out) || within(source, report)) {
    throw new Error('Output and reports must be outside the original workspace.');
  }
  try {
    await stat(out);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { source, out, report };
    }
    throw error;
  }
  throw new Error('Use a new output folder; existing workspaces are never overwritten.');
}
async function repositoryFolders(root: string): Promise<ReadonlyMap<string, string>> {
  const files = await readdir(root, { recursive: true });
  const folders = new Map<string, string>();
  for (const file of files.filter((name) => name.endsWith('repository.json'))) {
    const text = await readFile(path.join(root, file), 'utf8');
    const value = modelRecord(JSON.parse(text));
    const repo = modelText(value?.repo);
    if (repo !== null) folders.set(repo, path.dirname(file));
  }
  return folders;
}
async function appendBindings(file: string, records: readonly unknown[]): Promise<void> {
  const check = await modelValidator('evidence', 'bindings');
  for (const record of records) {
    if (!check(record)) {
      throw new Error(`Invalid authored document: ${JSON.stringify(check.errors)}`);
    }
  }
  let before = '';
  try {
    before = await readFile(file, 'utf8');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const lines = records.map((record) => JSON.stringify(record)).join('\n');
  await writeFile(file, `${before.trimEnd()}${before.trim() === '' ? '' : '\n'}${lines}\n`);
}
async function appendDocuments(out: string, workspace: MigratedWorkspace): Promise<void> {
  if (workspace.documents.size === 0) return;
  const root = path.join(out, 'evidence');
  const folders = await repositoryFolders(root);
  for (const [repo, records] of workspace.documents) {
    const folder = folders.get(repo);
    if (folder === undefined) {
      throw new Error(`No pinned evidence repository for authored GraphQL documents: ${repo}`);
    }
    await appendBindings(path.join(root, folder, 'bindings.jsonl'), records);
  }
}
/** The isolated validator shares the ordinary reader and never changes the caller's registry. */
export async function validateMigratedOutput(out: string): Promise<readonly unknown[]> {
  try {
    const text = await readFile(path.join(out, 'workspace.yaml'), 'utf8');
    const value = modelRecord(parse(text));
    const id = modelText(value?.id);
    if (id === null) throw new Error('Missing output workspace identity.');
    const registered = await workspaceFolder(id);
    if (registered === null || (await realpath(registered)) !== (await realpath(out))) {
      throw new Error(
        'Validation must read the selected output copy, not another registered workspace.',
      );
    }
    const model = await readModel(id);
    if (model === null) throw new Error('Cannot load the migrated workspace.');
    const currentProblems = await validateModel(model);
    if (currentProblems.length > 0) return currentProblems;
    const problems = indexOf(model)
      .gaps()
      .filter((gap) => gap.kind === 'unbacked_connection')
      .map((gap) => ({ at: gap.id, message: gap.message }));
    if (problems.length > 0) return problems;
    for (const plan of await readModelPlans(id)) {
      const check = await validatePlanProjection(plan, model);
      problems.push(...check.problems);
    }
    return problems;
  } catch (error) {
    return [{ at: out, message: error instanceof Error ? error.message : String(error) }];
  }
}
async function validateOutput(out: string): Promise<readonly unknown[]> {
  const args = [
    '--import',
    path.resolve('tools/register.ts'),
    '--conditions=react-server',
    path.resolve('tools/migrate-model.ts'),
    '--validate-output',
    out,
  ];
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(
      process.execPath,
      args,
      {
        encoding: 'utf8',
        env: { ...process.env, GROUNDWORK_WORKSPACES: out },
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, output) => {
        if (error === null) {
          resolve(output);
        } else {
          reject(new Error(error.message, { cause: error }));
        }
      },
    );
  });
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed)) {
    throw new TypeError('The output validator did not return its complete problem list.');
  }
  return parsed;
}

export async function migrateModel(
  options: MigrationOptions,
): Promise<Readonly<Record<string, unknown>>> {
  const locations = await newOutput(options);
  const review = migrationReview(options.accepted);
  await mkdir(locations.report, { recursive: true });
  let report: Readonly<Record<string, unknown>> = { status: 'failed' };
  try {
    const input = await authoredFiles(locations.source);
    const workspace = migrateWorkspace(input, review);
    const problems = await migrationProblems(workspace);
    report = {
      status: 'needs-review',
      source: fingerprint(input.map((file) => ({ path: file.path, text: file.text }))),
      files: workspace.files.size,
      problems,
      problemCauses: migrationSummary(problems),
      review: reviewSummary(review.rows()),
    };
    if (
      problems.length > 0 ||
      ['step-ids', 'identities', 'placements', 'documents'].some(
        (family) => review.pending(family) > 0,
      )
    ) {
      return report;
    }
    await cp(locations.source, locations.out, {
      recursive: true,
      mode: constants.COPYFILE_FICLONE,
      filter: (file) =>
        !['.git', '.groundwork', 'explorer', 'node_modules'].includes(
          path.relative(locations.source, file).split(path.sep)[0] ?? '',
        ),
    });
    for (const [file, fragment] of workspace.files) {
      await writeMigrationFile(locations.out, file, fragment.value);
    }
    await migrateEvidence(locations.source, locations.out, review);
    await appendDocuments(locations.out, workspace);
    const validation = await validateOutput(locations.out);
    report = {
      ...report,
      status: validation.length === 0 ? 'ready' : 'invalid',
      problems: validation,
      review: reviewSummary(review.rows()),
    };
    return report;
  } catch (error) {
    report = {
      ...report,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
    return report;
  } finally {
    await writeReviews(locations.report, review.rows());
    await writeFile(
      path.join(locations.report, 'migration.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  }
}
