import 'server-only';

import path from 'node:path';

import { parse } from 'yaml';

import type { Issue } from '@/application/plan/check-context';
import { neighbourOf } from '@/application/plan/check-neighbours';
import { isRecord, prop, strings } from '@/application/plan/ids';
import {
  type BaseInfo,
  collectionsOf,
  driftOf,
  NO_BASE,
  onBase,
  scopeOf,
} from '@/application/plan/plan-base';
import {
  changedSince,
  type Overlap,
  overlapsOf,
  type StackHashes,
  stackOf,
} from '@/application/plan/plan-stack';
import { issueStatusOf } from '@/application/plan/progress';
import {
  type Inherited,
  NOTHING_INHERITED,
  type StackLayer,
  stackedBase,
  stackOnto,
} from '@/application/plan/stack-base';
import type { Fanout } from '@/domain/plan/plan-graph';
import type { Neighbour, Neighbours } from '@/domain/plan/plan-neighbours';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Progress } from '@/domain/plan/plan.generated';
import { pathIn, listFolder, readText, readTextIfAny } from '@/infrastructure/disk';

import {
  type BaseReading,
  hasLanded,
  issueKey,
  ownIssues,
  readPlanBase,
  readPlanLock,
} from './plan-base-store';
import {
  checkPlanData,
  defProblems,
  planDef,
  type PlanCheck,
  shapePlanData,
} from './plan-validator';
import { listProgrammes, readProgrammeRaw } from './programme-store';
import { workspaceFolder } from './workspace-folders';
import { untilEdited } from './workspace-memo';

// <workspace>/plans/<slug>/plan.yaml
//   revisions/<version>.yaml   the plan as it stood at that version
//   progress.yaml              what has happened to its work items and milestones, oldest first
//   base.yaml, base.lock.json  see plan-base-store
// A plan file holds what the plan changes; it is read onto its base (today, or its kept copy once landed).
// A workspace no folder holds has no plans: its plan folder is a path that is not there.
async function planFolder(
  root: string | undefined,
  workspace: string,
  slug: string,
): Promise<string> {
  const folder = await workspaceFolder(workspace, root);
  return pathIn(folder ?? pathIn(root ?? '', '.no-such-workspace', workspace), 'plans', slug);
}

async function folders(folder: string): Promise<string[]> {
  const entries = await listFolder(folder);
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .toSorted((a, b) => a.localeCompare(b));
}

/** What reading a plan found, and where its today came from. */
export interface PlanRead extends PlanCheck {
  readonly base: BaseInfo;
  /** What the plans it builds on added and changed, by id: the part of its today that is not live yet. */
  readonly inherited: Inherited;
  /** The title of a plan held back by its checks, so its page can still name it. */
  readonly title?: string | null;
}

interface At {
  readonly workspace: string;
  readonly slug: string;
  readonly root: string | undefined;
  readonly fanout?: Fanout;
  /** Check every reference against the whole base, as when a plan is written; otherwise trust its last check. */
  readonly check?: boolean;
}

const indexed = untilEdited<Omit<Neighbours, 'slug'>>();

const neighbourIn = (raw: { readonly data: unknown } | { readonly error: Issue }): Neighbour =>
  neighbourOf('data' in raw ? raw.data : null);

/**
 * The ids each plan and programme of the workspace defines, as written, so a plan can resolve what it names in
 * them; read once until a file changes.
 */
export async function readNeighbourIndex(
  workspace: string,
  root?: string,
): Promise<Omit<Neighbours, 'slug'>> {
  return indexed(root, `neighbours\n${workspace}`, async () => {
    const [slugs, ids] = await Promise.all([
      listPlans(workspace, root),
      listProgrammes(workspace, root),
    ]);
    const plans = await Promise.all(
      slugs.map(async (each) =>
        readRaw(pathIn(await planFolder(root, workspace, each), 'plan.yaml')),
      ),
    );
    const programmes = await Promise.all(
      ids.map(async (id) => readProgrammeRaw(workspace, id, root)),
    );
    const landed = await Promise.all(slugs.map(async (each) => hasLanded(workspace, each, root)));
    const planOf = (i: number): Neighbour => ({
      ...neighbourIn(plans[i] ?? { data: null }),
      landed: landed[i] === true,
    });
    return {
      plans: new Map(slugs.map((each, i) => [each, planOf(i)])),
      programmes: new Map(ids.map((id, i) => [id, neighbourIn(programmes[i] ?? { data: null })])),
    };
  });
}

/** Every pair of open plans in the workspace, neither building on the other, that change the same thing. */
export async function readOverlaps(workspace: string, root?: string): Promise<readonly Overlap[]> {
  const { plans } = await readNeighbourIndex(workspace, root);
  return overlapsOf(plans);
}

async function neighboursOf(at: At): Promise<Neighbours> {
  return { slug: at.slug, ...(await readNeighbourIndex(at.workspace, at.root)) };
}

async function readRaw(
  file: string,
): Promise<{ readonly data: unknown } | { readonly error: Issue }> {
  try {
    return {
      data: parse(await readText(file), {
        prettyErrors: true,
        uniqueKeys: true,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: { path: '(root)', message } };
  }
}

/** Every version of the plan, as written, so they all draw the same part of today. */
async function versionsOf(at: At): Promise<unknown[]> {
  const folder = await planFolder(at.root, at.workspace, at.slug);
  const versions = await listRevisions(at.workspace, at.slug, at.root);
  const files = [
    pathIn(folder, 'plan.yaml'),
    ...versions.map((version) => pathIn(folder, 'revisions', `${version}.yaml`)),
  ];
  const raws = await Promise.all(files.map(readRaw));
  return raws.flatMap((raw) => ('data' in raw ? [raw.data] : []));
}

/** plans/<slug>/plan.yaml as written, unchecked; null when it cannot be read. */
export async function readPlanRaw(
  workspace: string,
  slug: string,
  root?: string,
): Promise<unknown> {
  const raw = await readRaw(pathIn(await planFolder(root, workspace, slug), 'plan.yaml'));
  return 'data' in raw ? raw.data : null;
}

/** Every version of a plan as written: plan.yaml, then each revision. */
export async function readVersions(
  workspace: string,
  slug: string,
  root?: string,
): Promise<unknown[]> {
  return versionsOf({ workspace, slug, root });
}

/** A plan's base with the open plans it builds on applied, what they did, and why that could not be done. */
export interface StackedReading {
  readonly reading: BaseReading;
  readonly inherited: Inherited;
  /** The open plans applied, bases first, with each one's title and the hash of what it says. */
  readonly builtOn: readonly {
    readonly slug: string;
    readonly title: string;
    readonly hash: string;
  }[];
  readonly errors: readonly Issue[];
}

const unstacked = (reading: BaseReading, errors: readonly Issue[] = []): StackedReading => ({
  reading,
  inherited: NOTHING_INHERITED,
  builtOn: [],
  errors,
});

const layers = untilEdited<StackLayer | Issue>();

/** A plan read (or checked, when the plan on it is) as a layer of another plan's stack, or why it cannot be one. */
async function layerOf(at: At, slug: string): Promise<StackLayer | Issue> {
  const check = at.check === true;
  return layers(at.root, `layer\n${String(check)}\n${at.workspace}\n${slug}`, async () => {
    const options = at.root === undefined ? {} : { root: at.root };
    const { plan, errors } = await (check ? checkPlan : readPlan)(at.workspace, slug, options);
    if (plan === null || errors.length > 0) {
      return {
        path: 'builds_on',
        message: `${slug} has ${String(errors.length)} error(s), so this plan cannot be read on top of it; fix ${slug} first`,
      };
    }
    const raw = await readRaw(pathIn(await planFolder(at.root, at.workspace, slug), 'plan.yaml'));
    const listed = Object.values(collectionsOf('data' in raw ? raw.data : null))
      .flat()
      .flatMap((entity) => (typeof entity.id === 'string' ? [entity.id] : []));
    return { slug, plan, listed: new Set(listed) };
  });
}

const stacks = untilEdited<StackedReading>();

/**
 * An open plan's base: today with the open plans in its builds_on closure applied, bases first. A landed plan
 * keeps its own copy, and a plan that builds on nothing open reads today as it is.
 */
async function stackedOn(raw: unknown, reading: BaseReading, at: At): Promise<StackedReading> {
  const { today } = reading;
  if (today === null) return unstacked(reading);
  const { plans } = await readNeighbourIndex(at.workspace, at.root);
  const stack = stackOf(at.slug, strings(prop(raw, 'builds_on')), plans);
  if (stack.cycle !== null) {
    const message = `the plans it builds on run in a circle (${stack.cycle.join(' → ')}), so they have no order; one must stop building on the next`;
    return unstacked(
      reading,
      stack.cycle.includes(at.slug) ? [] : [{ path: 'builds_on', message }],
    );
  }
  const { order } = stack;
  if (order.length === 0) return unstacked(reading);
  const mode = String(at.check === true);
  return stacks(at.root, `stack\n${mode}\n${at.workspace}\n${order.join('\n')}`, async () => {
    const read = await Promise.all(order.map(async (slug) => layerOf(at, slug)));
    const broken = read.filter((layer): layer is Issue => !('plan' in layer));
    const found = read.filter((layer): layer is StackLayer => 'plan' in layer);
    if (broken.length > 0) return unstacked(reading, broken);
    const stacked = stackOnto(today, found);
    return {
      reading: {
        base: stackedBase(stacked),
        own: ownIssues({ ...today, ...stacked.system }),
        today,
      },
      inherited: stacked.inherited,
      builtOn: found.map((layer) => ({
        slug: layer.slug,
        title: layer.plan.meta.title,
        hash: plans.get(layer.slug)?.hash ?? '',
      })),
      errors: stacked.problems.map((message) => ({
        path: 'builds_on',
        message: `${message}, once the plans it builds on are applied in order`,
      })),
    };
  });
}

/** The hashes a plan is read against now: each open plan it builds on, and its programme. */
async function hashesOf(raw: unknown, stacked: StackedReading, at: At): Promise<StackHashes> {
  const id = prop(prop(raw, 'meta'), 'programme');
  const { programmes } = await readNeighbourIndex(at.workspace, at.root);
  const hash = typeof id === 'string' ? programmes.get(id)?.hash : undefined;
  return {
    bases: Object.fromEntries(stacked.builtOn.map((layer) => [layer.slug, layer.hash])),
    programme: typeof id === 'string' && hash !== undefined ? { id, hash } : null,
  };
}

async function infoOf(raw: unknown, stacked: StackedReading, at: At): Promise<BaseInfo> {
  const { base } = stacked.reading;
  const lock = base.mode === 'live' ? await readPlanLock(at.workspace, at.slug, at.root) : null;
  const now = await hashesOf(raw, stacked, at);
  const changed = lock === null ? { bases: [], programme: false } : changedSince(lock, now);
  const { plans } = await readNeighbourIndex(at.workspace, at.root);
  return {
    mode: base.mode,
    landedOn: base.landedOn,
    checkedOn: lock?.checkedOn ?? null,
    edited: lock !== null && lock.plan !== (plans.get(at.slug)?.hash ?? null),
    drift: lock === null ? [] : driftOf(raw, base, lock.entities),
    builtOn: stacked.builtOn.map(({ slug, title }) => ({
      slug,
      title,
      changed: changed.bases.includes(slug),
    })),
    programme: now.programme === null ? null : { id: now.programme.id, changed: changed.programme },
    stale: changed.bases.length > 0 || changed.programme,
  };
}

/** What an open plan is read onto, and the hashes of the plans it builds on and its programme. */
export interface StackedBase {
  readonly stacked: StackedReading;
  readonly hashes: StackHashes;
  /** The hash of the plan as written now, to lock beside it once it is checked. */
  readonly plan: string | null;
}

/**
 * What an open plan is read onto, as the base tool locks it: its base with the plans it builds on applied, and
 * the hashes of those plans and its programme. Null outside a workspace.
 */
export async function readStackedBase(
  workspace: string,
  slug: string,
  root?: string,
): Promise<StackedBase | null> {
  const at: At = { workspace, slug, root, check: true };
  const reading = await readPlanBase(workspace, slug, root);
  const raw = await readRaw(pathIn(await planFolder(root, workspace, slug), 'plan.yaml'));
  if (reading === null || 'error' in raw) return null;
  const stacked = await stackedOn(raw.data, reading, at);
  const { plans } = await readNeighbourIndex(workspace, root);
  return {
    stacked,
    hashes: await hashesOf(raw.data, stacked, at),
    plan: plans.get(slug)?.hash ?? null,
  };
}

/** What stops a plan being read onto its base, its warnings, and its title should it be held back. */
interface Fit {
  readonly errors: readonly Issue[];
  readonly warnings: readonly Issue[];
  readonly held: boolean;
  readonly title: string | null;
}

/**
 * Whether the plan fits its stacked base. Checking, the plan is checked against the whole of it, so a change that
 * breaks something anywhere in today is caught, leaving out what the base finds wrong with itself. Reading, only
 * the stack itself can stop it.
 */
async function fitOf(
  data: Readonly<Record<string, unknown>>,
  stacked: StackedReading,
  at: At,
): Promise<Fit> {
  if (at.check !== true) {
    return { errors: stacked.errors, warnings: [], held: stacked.errors.length > 0, title: null };
  }
  const whole = onBase(data, stacked.reading.base, null);
  const [checked, own] = await Promise.all([
    checkPlanData(whole.doc, at.fanout, await neighboursOf(at)),
    stacked.reading.own(),
  ]);
  const notOwn = (issue: Issue): boolean => !own.has(issueKey(issue));
  const errors = [...stacked.errors, ...whole.issues, ...checked.errors.filter(notOwn)];
  return {
    errors,
    warnings: checked.warnings.filter(notOwn),
    held: errors.length > 0 || checked.plan === null,
    title: checked.plan?.meta.title ?? null,
  };
}

/** The part of the base a plan draws, with the plan: checked through, or (for a plan checked when written) shaped. */
async function partOf(doc: Record<string, unknown>, at: At): Promise<PlanCheck> {
  if (at.check !== true) return shapePlanData(doc);
  return checkPlanData(doc, at.fanout, await neighboursOf(at));
}

/**
 * Put the plan onto its base and give the part of the base the plan names, which is what its pages draw. A stacked
 * plan's base holds the plans it builds on, and the part it draws holds what they added and changed. A plan is
 * checked against the whole base when it is written (`check`); a read trusts that check and only shapes the part.
 */
async function readOnBase(
  data: Readonly<Record<string, unknown>>,
  landed: BaseReading,
  at: At,
): Promise<PlanRead> {
  const stacked = await stackedOn(data, landed, at);
  const { reading, inherited } = stacked;
  const { errors, warnings, held, title } = await fitOf(data, stacked, at);
  const base = await infoOf(data, stacked, at);
  if (held) return { plan: null, errors, warnings, base, inherited, title };
  const scope =
    reading.base.mode === 'landed'
      ? null
      : scopeOf(reading.base, [...(await versionsOf(at)), Object.keys(inherited)]);
  const part = await partOf(onBase(data, reading.base, scope).doc, at);
  if (part.plan === null || part.errors.length > 0) {
    const missing = part.errors.map((issue) => ({
      ...issue,
      message: `${issue.message} (in the part of today the plan draws)`,
    }));
    return { plan: null, errors: missing, warnings, base, inherited };
  }
  return { plan: part.plan, errors: [], warnings, base, inherited };
}

async function readPlanFile(file: string, at: At): Promise<PlanRead> {
  const raw = await readRaw(file);
  if ('error' in raw) {
    return {
      plan: null,
      errors: [raw.error],
      warnings: [],
      base: NO_BASE,
      inherited: NOTHING_INHERITED,
    };
  }
  const reading = isRecord(raw.data) ? await readPlanBase(at.workspace, at.slug, at.root) : null;
  if (reading === null || !isRecord(raw.data)) {
    const checked =
      at.check === true
        ? await checkPlanData(raw.data, at.fanout, await neighboursOf(at))
        : await shapePlanData(raw.data);
    return { ...checked, base: NO_BASE, inherited: NOTHING_INHERITED };
  }
  return readOnBase(raw.data, reading, at);
}

/** How a plan is read: where the workspaces are, and the federation fan-out to check its graph queries with. */
interface ReadOptions {
  readonly root?: string;
  readonly fanout?: Fanout;
}

const atOf = (workspace: string, slug: string, options: ReadOptions, check: boolean): At => ({
  workspace,
  slug,
  root: options.root,
  check,
  ...(options.fanout === undefined ? {} : { fanout: options.fanout }),
});

/** The slugs of a workspace's plans. */
export async function listPlans(workspace: string, root?: string): Promise<string[]> {
  return folders(path.dirname(await planFolder(root, workspace, '-')));
}

/**
 * Read plans/<slug>/plan.yaml onto its base, trusting the check it passed when it was written (see `checkPlan`):
 * only its YAML and its shape against the schema can stop it being read. `base.edited` says whether it has changed
 * since that check.
 */
export async function readPlan(
  workspace: string,
  slug: string,
  options: ReadOptions = {},
): Promise<PlanRead> {
  const folder = await planFolder(options.root, workspace, slug);
  return readPlanFile(pathIn(folder, 'plan.yaml'), atOf(workspace, slug, options, false));
}

/**
 * Read plans/<slug>/plan.yaml and check every reference it makes against the whole of its base, as is done when a
 * plan is written and before it is committed. Slow on a large workspace; pages read with `readPlan`.
 */
export async function checkPlan(
  workspace: string,
  slug: string,
  options: ReadOptions = {},
): Promise<PlanRead> {
  const folder = await planFolder(options.root, workspace, slug);
  return readPlanFile(pathIn(folder, 'plan.yaml'), atOf(workspace, slug, options, true));
}

/** The versions that have a plans/<slug>/revisions/<version>.yaml snapshot. */
export async function listRevisions(
  workspace: string,
  slug: string,
  root?: string,
): Promise<string[]> {
  const folder = await planFolder(root, workspace, slug);
  const entries = await listFolder(pathIn(folder, 'revisions'));
  return entries
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => name.slice(0, -'.yaml'.length))
    .toSorted((a, b) => a.localeCompare(b));
}

/** Read one revision snapshot onto its plan's base; `check` checks every reference too, as `checkPlan` does. */
export async function readRevision(
  at: { readonly workspace: string; readonly slug: string; readonly version: string },
  options: ReadOptions & { readonly check?: boolean } = {},
): Promise<PlanRead> {
  const folder = await planFolder(options.root, at.workspace, at.slug);
  return readPlanFile(
    pathIn(folder, 'revisions', `${path.basename(at.version)}.yaml`),
    atOf(at.workspace, at.slug, options, options.check === true),
  );
}

/** What reading a plan's progress.yaml found: the record, or why it cannot be read. */
export interface ProgressRead {
  readonly progress: Progress;
  readonly errors: readonly Issue[];
}

const NO_PROGRESS: Progress = { events: [] };

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
  const check = await planDef<Progress>('progress');
  if (check(raw.data)) return { progress: raw.data, errors: [] };
  return {
    progress: NO_PROGRESS,
    errors: defProblems(check).map((message) => ({ path: '(root)', message })),
  };
}

/** GitHub issue state per work item, from the GitHub events in progress.yaml; empty when it has none. */
export async function readStatus(
  workspace: string,
  slug: string,
  root?: string,
): Promise<IssueStatus> {
  const { progress } = await readProgress(workspace, slug, root);
  return issueStatusOf(progress);
}
