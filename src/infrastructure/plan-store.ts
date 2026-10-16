import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';
import { z } from 'zod';

import type { Issue } from '@/application/plan/check-context';
import { isRecord } from '@/application/plan/ids';
import { type BaseInfo, driftOf, NO_BASE, onBase, scopeOf } from '@/application/plan/plan-base';
import type { Fanout } from '@/domain/plan/plan-graph';
import type { IssueStatus } from '@/domain/plan/plan-status';

import { type BaseReading, issueKey, readPlanBase, readPlanLock } from './plan-base-store';
import { checkPlanData, type PlanCheck } from './plan-validator';

// workspaces/<workspace>/plans/<slug>/plan.yaml
//   revisions/<version>.yaml   the plan as it stood at that version
//   status.json                GitHub issue state per work item
//   base.yaml, base.lock.json  see plan-base-store
// A plan file holds what the plan changes; it is read onto its base (today, or its kept copy once landed).
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

/** What reading a plan found, and where its today came from. */
export interface PlanRead extends PlanCheck {
  readonly base: BaseInfo;
}

interface At {
  readonly workspace: string;
  readonly slug: string;
  readonly root: string;
  readonly fanout?: Fanout;
}

async function readRaw(file: string): Promise<{ data: unknown } | { error: Issue }> {
  try {
    return { data: parse(await readFile(file, 'utf8'), { prettyErrors: true, uniqueKeys: true }) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: { path: '(root)', message } };
  }
}

/** Every version of the plan, as written, so they all draw the same part of today. */
async function versionsOf(at: At): Promise<unknown[]> {
  const folder = planFolder(at.root, at.workspace, at.slug);
  const versions = await listRevisions(at.workspace, at.slug, at.root);
  const files = [
    path.join(folder, 'plan.yaml'),
    ...versions.map((version) => path.join(folder, 'revisions', `${version}.yaml`)),
  ];
  const raws = await Promise.all(files.map(readRaw));
  return raws.flatMap((raw) => ('data' in raw ? [raw.data] : []));
}

/** Every version of a plan as written: plan.yaml, then each revision. */
export async function readVersions(
  workspace: string,
  slug: string,
  root = defaultRoot(),
): Promise<unknown[]> {
  return versionsOf({ workspace, slug, root });
}

const notOwn = (reading: BaseReading) => (issue: Issue) => !reading.own.has(issueKey(issue));

async function infoOf(raw: unknown, reading: BaseReading, at: At): Promise<BaseInfo> {
  const { base } = reading;
  const lock = base.mode === 'live' ? await readPlanLock(at.workspace, at.slug, at.root) : null;
  return {
    mode: base.mode,
    landedOn: base.landedOn,
    checkedOn: lock?.checkedOn ?? null,
    drift: lock === null ? [] : driftOf(raw, base, lock.entities),
  };
}

/**
 * Check the plan against the whole of its base, so a change that breaks something anywhere in today is caught,
 * then give the part of the base the plan names, which is what its pages draw.
 */
async function readOnBase(
  data: Readonly<Record<string, unknown>>,
  reading: BaseReading,
  at: At,
): Promise<PlanRead> {
  const { fanout } = at;
  const whole = onBase(data, reading.base, null);
  const checked = await checkPlanData(whole.doc, fanout);
  const errors = [...whole.issues, ...checked.errors.filter(notOwn(reading))];
  const warnings = checked.warnings.filter(notOwn(reading));
  const base = await infoOf(data, reading, at);
  if (errors.length > 0 || checked.plan === null) return { plan: null, errors, warnings, base };
  const scope = reading.base.mode === 'landed' ? null : scopeOf(reading.base, await versionsOf(at));
  const part = await checkPlanData(onBase(data, reading.base, scope).doc, fanout);
  if (part.plan === null || part.errors.length > 0) {
    const missing = part.errors.map((issue) => ({
      ...issue,
      message: `${issue.message} (in the part of today the plan draws)`,
    }));
    return { plan: null, errors: missing, warnings, base };
  }
  return { plan: part.plan, errors: [], warnings, base };
}

async function readPlanFile(file: string, at: At, fanout?: Fanout): Promise<PlanRead> {
  const raw = await readRaw(file);
  if ('error' in raw) return { plan: null, errors: [raw.error], warnings: [], base: NO_BASE };
  const reading = isRecord(raw.data) ? await readPlanBase(at.workspace, at.slug, at.root) : null;
  if (reading === null || !isRecord(raw.data))
    return { ...(await checkPlanData(raw.data, fanout)), base: NO_BASE };
  return readOnBase(raw.data, reading, { ...at, ...(fanout === undefined ? {} : { fanout }) });
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
): Promise<PlanRead> {
  const root = options.root ?? defaultRoot();
  const folder = planFolder(root, workspace, slug);
  return readPlanFile(path.join(folder, 'plan.yaml'), { workspace, slug, root }, options.fanout);
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
): Promise<PlanRead> {
  const root = options.root ?? defaultRoot();
  const folder = planFolder(root, at.workspace, at.slug);
  return readPlanFile(
    path.join(folder, 'revisions', `${path.basename(at.version)}.yaml`),
    { workspace: at.workspace, slug: at.slug, root },
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
