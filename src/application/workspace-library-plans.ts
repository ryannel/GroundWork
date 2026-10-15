import { derive, type Model } from '@/application/plan/derive';
import {
  gatesOf,
  planStage,
  possessive,
  type Stage,
} from '@/application/plan-story-cover-standing';
import { buildSummary } from '@/application/plan-viz-milestone';
import { shortDate } from '@/application/plan-viz-state';
import { teamName } from '@/application/plan-viz-teams';

import type { PlanInput } from './plan-footprint';
import { planHref } from './plan-pages';

// A workspace's plans as the home page lists them: what each is waiting on, soonest need first. Someone arriving
// wants to know what needs them, what is moving and how far along it is; a finished plan matters least.

export type PlanGroup = 'decide' | 'delivery' | 'approved' | 'draft' | 'delivered';

/** One plan on a workspace's panel. */
export interface PlanBrief {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  readonly group: PlanGroup;
  /** What it is waiting on or how far it has come, in a few words. */
  readonly note: string;
  /** The note names a date already gone. */
  readonly late: boolean;
  readonly done: number;
  readonly total: number;
}

const GROUP_ORDER: readonly PlanGroup[] = ['decide', 'delivery', 'approved', 'draft', 'delivered'];

export const GROUP_NAMES: Readonly<Record<PlanGroup, string>> = {
  decide: 'Waiting on a decision',
  delivery: 'In delivery',
  approved: 'Approved, not started',
  draft: 'Draft',
  delivered: 'Delivered',
};

const GROUP_OF: Readonly<Record<Stage, PlanGroup>> = {
  review: 'decide',
  'in-delivery': 'delivery',
  approved: 'approved',
  draft: 'draft',
  delivered: 'delivered',
};

interface Note {
  readonly note: string;
  readonly late: boolean;
}

function decideNote(model: Model, today: Date): Note {
  const [first] = gatesOf(model);
  if (first === undefined) return { note: 'Ready for approval', late: false };
  const who = first.decider === undefined ? 'Nobody named' : teamName(model, first.decider);
  const by = first.decide_by;
  if (by === undefined) return { note: `${who} decides first`, late: false };
  const late = by < today.toISOString().slice(0, 10);
  const day = shortDate(by, today);
  return late
    ? { note: `${possessive(who)} answer was due ${day}`, late }
    : { note: `${who} decides first, by ${day}`, late };
}

function noteOf(model: Model, group: PlanGroup, today: Date): Note {
  const summary = buildSummary(model, today);
  if (group === 'decide') return decideNote(model, today);
  if (group === 'delivery') {
    const current = summary.current;
    const where = current === null ? '' : `, now on ${current.short}`;
    return {
      note: `${String(summary.done)} of ${String(summary.total)} work items done${where}`,
      late: current?.late ?? false,
    };
  }
  if (group === 'delivered' && summary.closed !== null) {
    return { note: `Finished ${shortDate(summary.closed, today)}`, late: false };
  }
  if (group === 'approved') return { note: 'Approved; no work started', late: false };
  return { note: 'Being written', late: false };
}

export function planBriefOf(workspace: string, input: PlanInput, today = new Date()): PlanBrief {
  const model = derive(input.plan, { status: input.status });
  const group = GROUP_OF[planStage(model)];
  const summary = buildSummary(model, today);
  return {
    id: input.slug,
    title: input.plan.meta.title,
    href: planHref({ workspace, slug: input.slug }),
    group,
    ...noteOf(model, group, today),
    done: summary.done,
    total: summary.total,
  };
}

/** The plans in the order someone should look at them. */
export function briefsOf(
  workspace: string,
  plans: readonly PlanInput[],
  today = new Date(),
): PlanBrief[] {
  return plans.map((plan) => planBriefOf(workspace, plan, today)).toSorted(byNeed);
}

function byNeed(a: PlanBrief, b: PlanBrief): number {
  const group = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
  if (group !== 0) return group;
  if (a.late !== b.late) return a.late ? -1 : 1;
  return a.title.localeCompare(b.title);
}
