import 'server-only';

import type { ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import type { Issue } from '@/application/plan/check-context';
import type { Progress } from '@/domain/model/plan.generated';
import { modelRecord } from '@/domain/workspace-model';
import { pathIn, readText, readTextIfAny } from '@/infrastructure/disk';

import { defProblems } from './plan-schema-errors';
import { planFolder, readRaw } from './plan-yaml';

/** What reading a plan's progress.yaml found: the record, or why it cannot be read. */
export interface ProgressRead {
  readonly progress: Progress;
  readonly errors: readonly Issue[];
}

const NO_PROGRESS: Progress = { events: [] };

let validator: Promise<ValidateFunction<Progress>> | undefined;

async function compileProgress(): Promise<ValidateFunction<Progress>> {
  const schema: unknown = JSON.parse(
    await readText(pathIn(process.cwd(), 'schema', 'plan.schema.json')),
  );
  const defs = modelRecord(modelRecord(schema)?.$defs);
  if (defs === null) throw new Error('plan.schema.json has no definitions.');
  const ajv = new Ajv2020({ allErrors: true, strict: false, verbose: true });
  addFormats(ajv);
  return ajv.compile<Progress>({
    $ref: '#/$defs/progress',
    $defs: { date: defs.date, progressEvent: defs.progressEvent, progress: defs.progress },
  });
}

/** Progress validation is independent of legacy plan documents and model facts. */
export const progressValidator = async (): Promise<ValidateFunction<Progress>> =>
  (validator ??= compileProgress());

/** plans/<slug>/progress.yaml, checked against the schema; an empty record when the plan has none. */
export async function readProgress(
  workspace: string,
  slug: string,
  root?: string,
): Promise<ProgressRead> {
  const file = pathIn(await planFolder(root, workspace, slug), 'progress.yaml');
  if ((await readTextIfAny(file)) === null) return { progress: NO_PROGRESS, errors: [] };
  const raw = await readRaw(file);
  if ('error' in raw) return { progress: NO_PROGRESS, errors: [raw.error] };
  const check = await progressValidator();
  if (check(raw.data)) return { progress: raw.data, errors: [] };
  return {
    progress: NO_PROGRESS,
    errors: defProblems(check).map((message) => ({ path: '(root)', message })),
  };
}
