// Plans for tests, worked out without the disk: a plan's model and pages on a fixed day, and an overlay put onto
// Acme's today the way the store puts a workspace plan onto its base.
import type { Issue } from '@/application/plan/check-context';
import { derive, type Model } from '@/application/plan/derive';
import {
  type BaseInfo,
  collectionsOf,
  NO_BASE,
  onBase,
  type PlanBase,
  scopeOf,
} from '@/application/plan/plan-base';
import { validatePlan } from '@/application/plan/validate-plan';
import { planCardOf, type PlanCard } from '@/application/plan-footprint';
import { type Outline, outlineOf } from '@/application/plan-pages';
import type { SystemModel } from '@/application/workspace-model';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

import { acme } from './workspace-kit';

/** The day every plan in tests is read on, so nothing falls overdue as the calendar moves. */
const FIXED_TODAY = new Date('2026-06-01');

/** What the app's planData gives a plan's pages, worked out from the plan alone. */
export interface PlanDataOf {
  readonly workspaceName: string;
  readonly model: Model;
  readonly outline: Outline;
  readonly plans: readonly PlanCard[];
  readonly base: BaseInfo;
}

export interface PlanAt {
  readonly workspace: string;
  readonly slug: string;
}

export interface ModelOptions {
  readonly status?: IssueStatus;
}

/** The plan's model as the app derives it, on FIXED_TODAY. */
export function modelOf(plan: Plan, options: ModelOptions = {}): Model {
  return derive(plan, { status: options.status ?? {}, today: FIXED_TODAY });
}

export interface PlanDataOptions extends ModelOptions {
  readonly workspaceName?: string;
  /** Defaults to NO_BASE, as for a plan with no workspace base. */
  readonly base?: BaseInfo;
}

/** The plan's page data, as planData() reads it from disk; the plan switcher holds only this plan. */
export function planDataOf(plan: Plan, where?: PlanAt, options: PlanDataOptions = {}): PlanDataOf {
  const at = where ?? { workspace: 'acme', slug: plan.meta.id };
  const status = options.status ?? {};
  const model = modelOf(plan, { status });
  return {
    workspaceName: options.workspaceName ?? 'Acme',
    model,
    outline: outlineOf(model, at),
    plans: [planCardOf(at.workspace, { slug: at.slug, plan, status })],
    base: options.base ?? NO_BASE,
  };
}

/**
 * A plan as written in a workspace: no system collections of its own (they come from today), just what it changes
 * and why. `context` names things in today the plan should draw even though no op touches them.
 */
export type PlanOverlay = Omit<Plan, 'teams' | 'services'> &
  Partial<Pick<Plan, 'teams' | 'services'>> & { readonly context?: readonly string[] };

export interface OnToday {
  /** What the app draws: the overlay with the part of today it names. */
  readonly plan: Plan;
  /** The overlay with the whole of today, which the checks run on. */
  readonly whole: Plan;
  /** Problems the plan has, not counting any today has of its own; none means the store would read it. */
  readonly errors: readonly Issue[];
  readonly warnings: readonly Issue[];
}

const keyOf = (issue: Issue): string => `${issue.path}\n${issue.message}`;

// onBase works on plan-shaped records; what it gives back is a whole plan once the base is in.
const asPlan = (doc: Readonly<Record<string, unknown>>): Plan => doc as unknown as Plan;

/**
 * Puts an overlay onto a workspace's today as the store does (readOnBase): checked against the whole of today,
 * drawn with the part it names. The schema check the store also runs is left out; it needs infrastructure.
 */
export function planOnToday(overlay: PlanOverlay, today: SystemModel): OnToday {
  const base: PlanBase = { collections: collectionsOf(today.plan), mode: 'live', landedOn: null };
  const raw: Readonly<Record<string, unknown>> = { ...overlay };
  const own = validatePlan(today.plan);
  const theirs = new Set([...own.errors, ...own.warnings].map(keyOf));
  const notOwn = (issue: Issue): boolean => !theirs.has(keyOf(issue));
  const whole = onBase(raw, base, null);
  const wholePlan = asPlan(whole.doc);
  const checked = validatePlan(wholePlan);
  const part = asPlan(onBase(raw, base, scopeOf(base, [raw])).doc);
  const drawn = validatePlan(part);
  const partErrors = drawn.errors.map((issue) => ({
    ...issue,
    message: `${issue.message} (in the part of today the plan draws)`,
  }));
  const errors = [...whole.issues, ...checked.errors.filter(notOwn)];
  return {
    plan: part,
    whole: wholePlan,
    errors: errors.length > 0 ? errors : partErrors,
    warnings: checked.warnings.filter(notOwn),
  };
}

/** An overlay put onto Acme's today. */
export function planOnAcme(overlay: PlanOverlay): OnToday {
  return planOnToday(overlay, acme().today);
}
