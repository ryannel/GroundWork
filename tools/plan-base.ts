// Keeps a plan honest about the today it is put onto.
//   npm run plan:base -- check <slug>   check an open plan against today, with the open plans it builds on applied,
//                                       and write base.lock.json: what each thing its ops modify, remove or add
//                                       after says now, the hash of each plan it builds on and of its programme,
//                                       and of what those plans make, and of the plan itself. The plan page warns
//                                       when any of them moves on, or the plan is written again; read the change,
//                                       fix the plan, check again. Pages trust this check rather than repeat it.
//   npm run plan:base -- land <slug>    the plan has shipped: keep the part of today it draws as base.yaml, so it
//                                       goes on reading as it stood while today moves on, and drop the lock. The
//                                       plans it builds on land first.
// Options: --workspace <id> (required when several are registered).
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { stringify } from 'yaml';

import { collectionsOf, driftOf, lockOf, onBase, scopeOf } from '@/application/plan/plan-base';
import { changedSince, unlandedBases } from '@/application/plan/plan-stack';
import { composedHashOf } from '@/application/plan/stack-base';
import { type PlanLock, readPlanBase, readPlanLock } from '@/infrastructure/plan-base-store';
import {
  checkPlan,
  readNeighbourIndex,
  readStackedBase,
  readVersions,
  type StackedBase,
} from '@/infrastructure/plan-store';
import { selectedWorkspace, workspaceFolder } from '@/infrastructure/workspace-folders';

async function planFolder(workspace: string, slug: string): Promise<string> {
  const folder = await workspaceFolder(workspace);
  if (folder === null) throw new Error(`no workspace ${workspace}`);
  return path.join(folder, 'plans', slug);
}

const today = (): string => new Date().toISOString().slice(0, 10);

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { workspace: { type: 'string' } },
});

async function workspaceId(): Promise<string> {
  const found = await selectedWorkspace(values.workspace);
  console.error(`Workspace: ${found.name} (${found.id}) at ${found.folder}`);
  process.env.GROUNDWORK_WORKSPACES = found.folder;
  return found.id;
}

/** Says which moves under the plan the new lock accepts: today's, and the plans and programme below it. */
function acceptedOf(before: PlanLock | null, raw: unknown, found: StackedBase): readonly string[] {
  if (before === null) return [];
  const { base } = found.stacked.reading;
  const changed = changedSince(before, found.hashes);
  const programme = changed.programme ? [found.hashes.programme?.id ?? ''] : [];
  return [...driftOf(raw, base, before.entities), ...changed.bases, ...programme];
}

async function check(workspace: string, slug: string): Promise<void> {
  const found = await readStackedBase(workspace, slug);
  if (found === null) throw new Error(`${slug} cannot be read; see plans/${slug}/plan.yaml`);
  const { stacked, hashes } = found;
  const { base } = stacked.reading;
  if (base.mode !== 'live') throw new Error(`${slug} has landed; it no longer reads today`);
  const read = await checkPlan(workspace, slug);
  for (const issue of read.errors) console.error(`${issue.path}: ${issue.message}`);
  if (read.errors.length > 0) throw new Error(`${slug} does not fit today; fix it and check again`);
  const [raw] = await readVersions(workspace, slug);
  const accepted = acceptedOf(await readPlanLock(workspace, slug), raw, found);
  const lock = {
    checked_on: today(),
    entities: lockOf(raw, base),
    bases: hashes.bases,
    programme: hashes.programme,
    composed: stacked.builtOn.length === 0 ? null : composedHashOf(base, stacked.inherited),
    plan: found.plan,
  };
  const file = path.join(await planFolder(workspace, slug), 'base.lock.json');
  await writeFile(file, `${JSON.stringify(lock, null, 2)}\n`);
  const after = stacked.builtOn.map((layer) => layer.slug);
  const on = after.length === 0 ? 'today' : `today after ${after.join(', ')}`;
  console.log(`${slug} fits ${on}; ${String(Object.keys(lock.entities).length)} things locked`);
  if (accepted.length > 0) console.log(`accepted the changes to ${accepted.join(', ')}`);
}

async function land(workspace: string, slug: string): Promise<void> {
  const reading = await readPlanBase(workspace, slug);
  if (reading?.base.mode !== 'live') throw new Error(`${slug} has already landed`);
  const { plans } = await readNeighbourIndex(workspace);
  const waiting = unlandedBases(slug, plans);
  if (waiting.length > 0) {
    throw new Error(
      `${slug} builds on ${waiting.join(', ')}, which ${waiting.length === 1 ? 'has' : 'have'} not landed yet; land ${waiting.join(', then ')} first`,
    );
  }
  const versions = await readVersions(workspace, slug);
  const scope = scopeOf(reading.base, versions);
  const { doc } = onBase({}, reading.base, scope);
  const folder = await planFolder(workspace, slug);
  const header = `# Today as ${slug} found it, kept now the plan has landed. Today has moved on since; see the workspace.\n`;
  const body = stringify({ landed_on: today(), ...collectionsOf(doc) }, { lineWidth: 0 });
  await writeFile(path.join(folder, 'base.yaml'), header + body);
  await rm(path.join(folder, 'base.lock.json'), { force: true });
  console.log(`${slug} landed on ${today()}`);
}

const [command, slug] = positionals;
const run = { check, land }[command ?? ''];
if (run === undefined || slug === undefined) {
  console.error('usage: npm run plan:base -- <check|land> <slug> [--workspace <id>]');
  process.exitCode = 1;
} else {
  await run(await workspaceId(), slug);
}
