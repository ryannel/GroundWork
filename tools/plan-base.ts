// Keeps a plan honest about the today it is put onto.
//   npm run plan:base -- check <slug>   check an open plan against today and write base.lock.json: what each thing
//                                       its ops modify, remove or add after says now. The plan page warns when
//                                       today moves any of them on; read the change, fix the plan, check again.
//   npm run plan:base -- land <slug>    the plan has shipped: keep the part of today it draws as base.yaml, so it
//                                       goes on reading as it stood while today moves on, and drop the lock.
// Options: --workspace <id> (the first workspace when not given).
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { stringify } from 'yaml';

import { collectionsOf, driftOf, lockOf, onBase, scopeOf } from '@/application/plan/plan-base';
import { readPlanBase, readPlanLock } from '@/infrastructure/plan-base-store';
import { readPlan, readVersions } from '@/infrastructure/plan-store';
import { readWorkspaces } from '@/infrastructure/workspace-store';

const ROOT = path.join(process.cwd(), 'workspaces');
const today = (): string => new Date().toISOString().slice(0, 10);

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { workspace: { type: 'string' } },
});

async function workspaceId(): Promise<string> {
  const all = await readWorkspaces(ROOT);
  const found = all.find(({ id }) => values.workspace === undefined || id === values.workspace);
  if (found === undefined) throw new Error(`no workspace ${values.workspace ?? ''}`);
  return found.id;
}

async function check(workspace: string, slug: string): Promise<void> {
  const reading = await readPlanBase(workspace, slug, ROOT);
  if (reading?.base.mode !== 'live')
    throw new Error(`${slug} has landed; it no longer reads today`);
  const read = await readPlan(workspace, slug, { root: ROOT });
  for (const issue of read.errors) console.error(`${issue.path}: ${issue.message}`);
  if (read.errors.length > 0) throw new Error(`${slug} does not fit today; fix it and check again`);
  const [raw] = await readVersions(workspace, slug, ROOT);
  const before = await readPlanLock(workspace, slug, ROOT);
  const moved = before === null ? [] : driftOf(raw, reading.base, before.entities);
  const lock = { checked_on: today(), entities: lockOf(raw, reading.base) };
  const file = path.join(ROOT, workspace, 'plans', slug, 'base.lock.json');
  await writeFile(file, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`${slug} fits today; ${String(Object.keys(lock.entities).length)} things locked`);
  if (moved.length > 0) console.log(`accepted today's changes to ${moved.join(', ')}`);
}

async function land(workspace: string, slug: string): Promise<void> {
  const reading = await readPlanBase(workspace, slug, ROOT);
  if (reading?.base.mode !== 'live') throw new Error(`${slug} has already landed`);
  const versions = await readVersions(workspace, slug, ROOT);
  const scope = scopeOf(reading.base, versions);
  const { doc } = onBase({}, reading.base, scope);
  const folder = path.join(ROOT, workspace, 'plans', slug);
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
