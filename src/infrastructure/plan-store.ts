import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';
import { z } from 'zod';

import type { Fanout } from '@/domain/plan/plan-graph';
import type { IssueStatus } from '@/domain/plan/plan-status';

import { checkPlanData, type PlanCheck } from './plan-validator';

// workspaces/<workspace>/plans/<slug>/plan.yaml
//   revisions/<version>.yaml   the plan as it stood at that version
//   status.json                GitHub issue state per work item
const defaultRoot = (): string => path.join(process.cwd(), 'workspaces');
const planFolder = (root: string, workspace: string, slug: string): string =>
  path.join(root, workspace, 'plans', slug);

const statusFile = z.record(
  z.string(),
  z.object({
    state: z.enum(['open', 'closed']),
    closed_at: z.string().optional(),
    url: z.string().optional(),
  }),
);

async function folders(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .toSorted((a, b) => a.localeCompare(b));
}

async function readPlanFile(file: string, fanout?: Fanout): Promise<PlanCheck> {
  let data: unknown;
  try {
    data = parse(await readFile(file, 'utf8'), { prettyErrors: true, uniqueKeys: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { plan: null, errors: [{ path: '(root)', message }], warnings: [] };
  }
  return checkPlanData(data, fanout);
}

/** The slugs of a workspace's plans. */
export async function listPlans(workspace: string, root = defaultRoot()): Promise<string[]> {
  return folders(path.join(root, workspace, 'plans'));
}

/** Read and check plans/<slug>/plan.yaml. */
export async function readPlan(
  workspace: string,
  slug: string,
  options: { root?: string; fanout?: Fanout } = {},
): Promise<PlanCheck> {
  const folder = planFolder(options.root ?? defaultRoot(), workspace, slug);
  return readPlanFile(path.join(folder, 'plan.yaml'), options.fanout);
}

/** The versions that have a plans/<slug>/revisions/<version>.yaml snapshot. */
export async function listRevisions(
  workspace: string,
  slug: string,
  root = defaultRoot(),
): Promise<string[]> {
  const entries = await readdir(path.join(planFolder(root, workspace, slug), 'revisions')).catch(
    () => [],
  );
  return entries
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => name.slice(0, -'.yaml'.length))
    .toSorted((a, b) => a.localeCompare(b));
}

/** Read and check one revision snapshot. */
export async function readRevision(
  at: { workspace: string; slug: string; version: string },
  options: { root?: string; fanout?: Fanout } = {},
): Promise<PlanCheck> {
  const folder = planFolder(options.root ?? defaultRoot(), at.workspace, at.slug);
  return readPlanFile(
    path.join(folder, 'revisions', `${path.basename(at.version)}.yaml`),
    options.fanout,
  );
}

/** GitHub issue state per work item; empty when the plan has no status.json. */
export async function readStatus(
  workspace: string,
  slug: string,
  root = defaultRoot(),
): Promise<IssueStatus> {
  const file = path.join(planFolder(root, workspace, slug), 'status.json');
  const text = await readFile(file, 'utf8').catch(() => null);
  if (text === null) return {};
  const result = statusFile.safeParse(JSON.parse(text));
  if (!result.success) throw new Error(`${file}: ${result.error.message}`);
  return result.data;
}
