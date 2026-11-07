import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import { indexOf } from '@/application/model-index';
import { modelRecord, type WorkspaceModel } from '@/domain/workspace-model';
import { readModelFolder } from '@/infrastructure/read-model';
import { validateModel } from '@/infrastructure/validate-model';

const LOCAL_FOLDERS = new Set([
  '.git',
  '.agents',
  '.claude',
  '.github',
  '.groundwork',
  'explorer',
  'artifacts',
]);

function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function evidenceDirectory(folder: string, repo: string): Promise<string> {
  const entries = await readdir(path.join(folder, 'evidence'), { recursive: true });
  for (const name of entries.filter((file) => path.basename(file) === 'repository.json')) {
    const text = await readFile(path.join(folder, 'evidence', name), 'utf8');
    const value: unknown = JSON.parse(text);
    if (modelRecord(value)?.repo === repo) return path.join('evidence', path.dirname(name));
  }
  throw new Error(`No canonical evidence folder for ${repo}.`);
}

export async function appendEvidence(
  folder: string,
  file: string,
  rows: readonly unknown[],
): Promise<string> {
  const previous = await readFile(path.join(folder, file), 'utf8').catch((error: unknown) => {
    if (missing(error)) return '';
    throw error;
  });
  const separator = previous === '' || previous.endsWith('\n') ? '' : '\n';
  return `${previous}${separator}${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
}

interface ScanOutput {
  readonly folder: string;
  readonly out: string;
  readonly before: WorkspaceModel;
  readonly writes: ReadonlyMap<string, string>;
}

async function validateCandidate(input: ScanOutput, stage: string): Promise<void> {
  const after = await readModelFolder(stage, input.before.id);
  const issues = await validateModel(after);
  if (issues.length > 0) {
    throw new Error(
      `The scan candidate fails current model validation: ${JSON.stringify(issues.slice(0, 10))}`,
    );
  }
  const oldProblems = new Set(
    input.before.problems.map((gap) =>
      JSON.stringify([gap.id, gap.kind, gap.property, gap.reference]),
    ),
  );
  const newProblems = after.problems.filter(
    (gap) => !oldProblems.has(JSON.stringify([gap.id, gap.kind, gap.property, gap.reference])),
  );
  if (newProblems.length > 0) {
    throw new Error(
      `The scan introduced unresolved citations: ${JSON.stringify(newProblems.slice(0, 10))}`,
    );
  }
  indexOf(after);
}

async function writeCandidateFile(stage: string, file: string, text: string): Promise<void> {
  const target = path.resolve(stage, file);
  const folder = await realpath(path.dirname(target));
  if (folder !== stage && !folder.startsWith(`${stage}${path.sep}`)) {
    throw new Error(`Scan output path leaves its candidate: ${file}.`);
  }
  const entry = await lstat(target).catch((error: unknown) => {
    if (missing(error)) return null;
    throw error;
  });
  if (entry !== null && !entry.isFile()) {
    throw new Error(`Scan output path is not a regular file: ${file}.`);
  }
  await writeFile(target, text);
}

/** Publish a separate candidate only after its new files have been read through the normal model loader. */
export async function publishScan(input: ScanOutput): Promise<void> {
  const existing = await lstat(input.out).catch((error: unknown) => {
    if (missing(error)) return null;
    throw error;
  });
  if (existing !== null) {
    throw new Error('Use a new output workspace outside the registered workspace.');
  }
  const temporary = await mkdtemp(path.join(path.dirname(input.out), '.model-scan-'));
  const stage = path.join(temporary, 'workspace');
  await cp(input.folder, stage, {
    recursive: true,
    errorOnExist: true,
    force: false,
    filter: (file) =>
      !LOCAL_FOLDERS.has(path.relative(input.folder, file).split(path.sep)[0] ?? ''),
  });
  const canonicalStage = await realpath(stage);
  for (const [file, text] of input.writes) {
    await writeCandidateFile(canonicalStage, file, text);
  }
  if (input.writes.size > 0) await validateCandidate(input, stage);
  await mkdir(input.out);
  try {
    await rename(stage, input.out);
  } catch (error) {
    await rmdir(input.out);
    throw error;
  }
  await rmdir(temporary);
}
