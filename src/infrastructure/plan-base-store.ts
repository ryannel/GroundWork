import 'server-only';

import { parse } from 'yaml';
import { z } from 'zod';

import type { Issue } from '@/application/plan/check-context';
import { isRecord } from '@/application/plan/ids';
import { collectionsOf, type PlanBase } from '@/application/plan/plan-base';
import type { StackHashes } from '@/application/plan/plan-stack';
import type { Plan } from '@/domain/plan/plan.generated';
import { pathIn, readTextIfAny, statOf } from '@/infrastructure/disk';

import { checkPlanData } from './plan-validator';
import { readToday } from './today-model';
import { workspaceFolder } from './workspace-folders';
import { untilEdited } from './workspace-memo';

// plans/<slug>/base.yaml        a landed plan's today, kept as it stood: landed_on and the collections
// plans/<slug>/base.lock.json   what the things the plan's ops lean on said when it was last checked, and the hash
//                               of each plan it builds on, of its programme and of what the plans below it make

/** A plan's base and what the base finds wrong with itself, which a plan is not blamed for. */
export interface BaseReading {
  readonly base: PlanBase;
  /** What the base finds wrong with itself; worked out only when a plan is checked, then kept. */
  readonly own: () => Promise<ReadonlySet<string>>;
  /** Today as a checked plan, to compose the plans a plan builds on onto; null for a landed plan's kept copy. */
  readonly today: Plan | null;
}

export interface PlanLock extends StackHashes {
  readonly checkedOn: string;
  readonly entities: Readonly<Record<string, string>>;
  /** The hash of what the plans below this one added and changed; null before stacking was locked. */
  readonly composed: string | null;
  /** The hash of the plan.yaml that was checked; null when the lock predates recording it. */
  readonly plan: string | null;
}

const lockFile = z.strictObject({
  checked_on: z.string(),
  entities: z.record(z.string(), z.string()),
  bases: z.record(z.string(), z.string()).optional(),
  programme: z.strictObject({ id: z.string(), hash: z.string() }).nullable().optional(),
  composed: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
});

export const issueKey = (issue: Issue): string => `${issue.path}\n${issue.message}`;

/** What checking plan-shaped data finds wrong with it, as issue keys; worked out on the first call, then kept. */
export function ownIssues(data: unknown): () => Promise<ReadonlySet<string>> {
  let found: Promise<ReadonlySet<string>> | undefined;
  return async () => {
    found ??= checkPlanData(data).then(
      (check) => new Set([...check.errors, ...check.warnings].map(issueKey)),
    );
    return found;
  };
}

const NO_ISSUES: Promise<ReadonlySet<string>> = Promise.resolve(new Set());
const NOTHING_OWN = async (): Promise<ReadonlySet<string>> => NO_ISSUES;

const remembered = untilEdited<BaseReading | null>();

/** The workspace's model of today as a base, read once until a file changes. Null when there is no such workspace. */
async function todayBase(workspace: string, root?: string): Promise<BaseReading | null> {
  return remembered(root, workspace, async () => {
    const found = await readToday(workspace, root);
    if (found === null) return null;
    const { today } = found;
    return {
      base: { collections: collectionsOf(today.plan), mode: 'live', landedOn: null },
      own: ownIssues(today.plan),
      today: today.plan,
    };
  });
}

/** What a plan is put onto: its kept copy once landed, otherwise today. Null outside a workspace. */
export async function readPlanBase(
  workspace: string,
  slug: string,
  root?: string,
): Promise<BaseReading | null> {
  const folder = await workspaceFolder(workspace, root);
  if (folder === null) return null;
  const file = pathIn(folder, 'plans', slug, 'base.yaml');
  const text = await readTextIfAny(file);
  if (text === null) return todayBase(workspace, root);
  const data: unknown = parse(text, { uniqueKeys: true });
  if (!isRecord(data)) throw new Error(`${file}: a base must be a mapping`);
  const landedOn = typeof data.landed_on === 'string' ? data.landed_on : null;
  return {
    base: { collections: collectionsOf(data), mode: 'landed', landedOn },
    own: NOTHING_OWN,
    today: null,
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
  const file = pathIn(folder, 'plans', slug, 'base.lock.json');
  const text = await readTextIfAny(file);
  if (text === null) return null;
  const result = lockFile.safeParse(JSON.parse(text));
  if (!result.success) throw new Error(`${file}: ${result.error.message}`);
  const { data } = result;
  return {
    checkedOn: data.checked_on,
    entities: data.entities,
    bases: data.bases ?? {},
    programme: data.programme ?? null,
    composed: data.composed ?? null,
    plan: data.plan ?? null,
  };
}

/** Whether a plan has landed: it keeps the today it changed as base.yaml. */
export async function hasLanded(workspace: string, slug: string, root?: string): Promise<boolean> {
  const folder = await workspaceFolder(workspace, root);
  if (folder === null) return false;
  return (await statOf(pathIn(folder, 'plans', slug, 'base.yaml'))) !== null;
}
