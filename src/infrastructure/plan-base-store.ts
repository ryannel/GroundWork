import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';
import { z } from 'zod';

import type { Issue } from '@/application/plan/check-context';
import { isRecord } from '@/application/plan/ids';
import { collectionsOf, type PlanBase } from '@/application/plan/plan-base';
import { systemModelOf } from '@/application/workspace-model';
import { findWorkspace } from '@/application/workspace-paths';

import { checkPlanData } from './plan-validator';
import { workspaceFolder } from './workspace-folders';
import { readWorkspaceModel } from './workspace-model';
import { readWorkspaces } from './workspace-store';

// plans/<slug>/base.yaml        a landed plan's today, kept as it stood: landed_on and the collections
// plans/<slug>/base.lock.json   what the things the plan's ops lean on said when it was last checked

/** A plan's base and what the base finds wrong with itself, which a plan is not blamed for. */
export interface BaseReading {
  readonly base: PlanBase;
  readonly own: ReadonlySet<string>;
}

export interface PlanLock {
  readonly checkedOn: string;
  readonly entities: Readonly<Record<string, string>>;
}

const lockFile = z.strictObject({
  checked_on: z.string(),
  entities: z.record(z.string(), z.string()),
});

export const issueKey = (issue: Issue): string => `${issue.path}\n${issue.message}`;

const todays = new Map<string, Promise<BaseReading | null>>();

async function readTodayBase(workspace: string, root?: string): Promise<BaseReading | null> {
  if ((await workspaceFolder(workspace, root)) === null) return null;
  const found = findWorkspace(await readWorkspaces(root), workspace);
  if (found === null) return null;
  const today = systemModelOf(found, await readWorkspaceModel(found, root));
  const check = await checkPlanData(today.plan);
  const own = new Set([...check.errors, ...check.warnings].map(issueKey));
  return {
    base: { collections: collectionsOf(today.plan), mode: 'live', landedOn: null },
    own,
  };
}

/** The workspace's model of today as a base, read once per build. Null when there is no such workspace. */
async function todayBase(workspace: string, root?: string): Promise<BaseReading | null> {
  const key = `${root ?? ''}\n${workspace}`;
  const known = todays.get(key);
  if (known !== undefined) return known;
  const reading = readTodayBase(workspace, root);
  todays.set(key, reading);
  return reading;
}

async function readText(file: string): Promise<string | null> {
  return readFile(file, 'utf8').catch(() => null);
}

/** What a plan is put onto: its kept copy once landed, otherwise today. Null outside a workspace. */
export async function readPlanBase(
  workspace: string,
  slug: string,
  root?: string,
): Promise<BaseReading | null> {
  const folder = await workspaceFolder(workspace, root);
  if (folder === null) return null;
  const file = path.join(folder, 'plans', slug, 'base.yaml');
  const text = await readText(file);
  if (text === null) return todayBase(workspace, root);
  const data: unknown = parse(text, { uniqueKeys: true });
  if (!isRecord(data)) throw new Error(`${file}: a base must be a mapping`);
  const landedOn = typeof data.landed_on === 'string' ? data.landed_on : null;
  return {
    base: { collections: collectionsOf(data), mode: 'landed', landedOn },
    own: new Set(),
  };
}

/** The lock beside a plan; null when it has never been checked against today. */
export async function readPlanLock(
  workspace: string,
  slug: string,
  root?: string,
): Promise<PlanLock | null> {
  const folder = await workspaceFolder(workspace, root);
  if (folder === null) return null;
  const file = path.join(folder, 'plans', slug, 'base.lock.json');
  const text = await readText(file);
  if (text === null) return null;
  const result = lockFile.safeParse(JSON.parse(text));
  if (!result.success) throw new Error(`${file}: ${result.error.message}`);
  return { checkedOn: result.data.checked_on, entities: result.data.entities };
}
