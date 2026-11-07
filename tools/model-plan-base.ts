import { constants } from 'node:fs';
import {
  copyFile,
  cp,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { stringify } from 'yaml';

import { inheritedPlanOrder } from '@/application/plans-index';
import type { WorkspaceModel } from '@/domain/workspace-model';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelFrozenBases, readModelPlanBaseMarkers } from '@/infrastructure/model-plan-base';
import { readSelectedPlanContext } from '@/infrastructure/model-plan-context';
import { modelPlanLockOf } from '@/infrastructure/model-plan-lock';
import { readModelPlanEntries } from '@/infrastructure/model-plans';
import { modelValidator } from '@/infrastructure/model-schema';
import { NATIVE_PLAN_LOCK_FORMAT, readPlanLock } from '@/infrastructure/plan-lock';
import { readModelFolder } from '@/infrastructure/read-model';
import { validateModel, validatePlanProjections } from '@/infrastructure/validate-model';
import { workspaceFolder } from '@/infrastructure/workspace-folders';

const INPUTS = new Set([
  'workspace.yaml',
  'domains',
  'libraries.yaml',
  'externals.yaml',
  'aliases.yaml',
  'language.yaml',
  'landscape.yaml',
  'graphs',
  'flows',
  'journeys',
  'programmes',
  'evidence',
]);
const today = (): string => new Date().toISOString().slice(0, 10);

async function copyInputs(folder: string, snapshot: string): Promise<void> {
  const entries = await readdir(folder);
  for (const entry of entries.filter((name) => INPUTS.has(name))) {
    await cp(path.join(folder, entry), path.join(snapshot, entry), {
      recursive: true,
      dereference: true,
      filter: async (source) => {
        const info = await lstat(source);
        return !info.isDirectory() || !path.basename(source).startsWith('.');
      },
    });
  }
}

async function freeze(
  folder: string,
  planFolder: string,
  id: string,
  current: WorkspaceModel,
): Promise<void> {
  const snapshot = await mkdtemp(path.join(planFolder, '.base-'));
  try {
    await copyInputs(folder, snapshot);
    const frozen = await readModelFolder(snapshot, id);
    const problems = await validateModel(frozen);
    if (problems.length > 0) throw new Error(JSON.stringify(problems));
    if (!isDeepStrictEqual(frozen, current)) {
      throw new Error('Frozen canonical inputs differ from the validated current model.');
    }
    const marker = { format: 'groundwork-model-base/v1', landed_on: today() };
    const check = await modelValidator('workspace', 'PlanBaseMarker');
    if (!check(marker)) throw new Error('Invalid native base marker.');
    await rename(snapshot, path.join(planFolder, 'base'));
    await writeFile(path.join(planFolder, 'base.yaml'), stringify(marker), { flag: 'wx' });
    await rm(path.join(planFolder, 'base.lock.json'), { force: true });
  } finally {
    await rm(snapshot, { recursive: true, force: true });
  }
}

/** Keep the old check as history before writing a verified native check or frozen basis. */
async function archivePreviousLock(
  id: string,
  slug: string,
  folder: string,
  root?: string,
): Promise<void> {
  const previous = await readPlanLock(id, slug, root);
  if (previous === null || previous.format === NATIVE_PLAN_LOCK_FORMAT) return;
  const active = path.join(folder, 'base.lock.json');
  const archive = path.join(folder, 'base.previous.lock.json');
  try {
    await copyFile(active, archive, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    const [activeBytes, archivedBytes] = await Promise.all([readFile(active), readFile(archive)]);
    if (!activeBytes.equals(archivedBytes)) throw error;
  }
}

/** Native check and land use canonical facts; null means the selected workspace is not native. */
export async function runModelPlanBase(
  command: 'check' | 'land',
  id: string,
  slug: string,
  root?: string,
): Promise<string | null> {
  const current = await readCanonicalModelIndex(id, root);
  if (current === null) return null;
  const entries = await readModelPlanEntries(id, root);
  const selected = entries.find((entry) => entry.slug === slug);
  const folder = await workspaceFolder(id, root);
  if (selected === undefined || folder === null) throw new Error(`No such native plan: ${slug}`);
  const markers = await readModelPlanBaseMarkers(id, root);
  if (markers.has(selected.plan.meta.id)) {
    throw new Error(`${slug} has landed; it no longer reads today`);
  }
  const plans = entries.map((entry) => entry.plan);
  const landed = new Set(markers.keys());
  const ancestors = inheritedPlanOrder(
    selected.plan,
    new Map(plans.map((plan) => [plan.meta.id, plan])),
    landed,
  );
  if (command === 'land' && ancestors.length > 0) {
    throw new Error(
      `${slug} builds on open plans ${ancestors.map((plan) => plan.meta.id).join(', ')}; land them first`,
    );
  }
  const frozenBases = await readModelFrozenBases(id, root);
  const batch = await validatePlanProjections(plans, current.model, {
    frozenBases,
    selected: [selected.plan.meta.id],
  });
  if (batch.problems.length > 0) throw new Error(JSON.stringify(batch.problems));
  const context = await readSelectedPlanContext(id, slug, root);
  if (context === null) throw new Error(`Missing native projection: ${slug}`);
  const planFolder = path.join(folder, 'plans', selected.slug);
  await archivePreviousLock(id, slug, planFolder, root);
  if (command === 'land') {
    await freeze(folder, planFolder, id, current.model);
    return `${slug} landed on ${today()}; canonical before model retained`;
  }
  const lock = modelPlanLockOf(context, plans, landed, today());
  await writeFile(
    path.join(planFolder, 'base.lock.json'),
    `${JSON.stringify(
      {
        format: lock.format,
        checked_on: lock.checkedOn,
        entities: lock.entities,
        bases: lock.bases,
        programme: lock.programme,
        composed: lock.composed,
        plan: lock.plan,
      },
      null,
      2,
    )}\n`,
  );
  return `${slug} fits its native base; ${String(Object.keys(lock.entities).length)} things locked`;
}
