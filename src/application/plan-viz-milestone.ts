import type { Model } from '@/application/plan/derive';
import { msShort } from '@/application/plan-viz-ladder-order';
import { isoDay, shortDate } from '@/application/plan-viz-state';
import {
  milestoneById,
  msTitle,
  criticalSet,
  wiState,
  workList,
  workOrdered,
} from '@/application/plan-viz-work';
import type { Milestone, WorkItem } from '@/domain/plan/plan.generated';

// A milestone, read once for every surface: counts come from the work items' own state, never from a second tally.

export interface MilestoneState {
  readonly id: string;
  readonly ms: Milestone;
  readonly short: string;
  readonly title: string;
  readonly total: number;
  readonly done: number;
  readonly started: boolean;
  readonly allDone: boolean;
  readonly closedAt: string | null;
  readonly due: string | null;
  /** "due 16 Oct", or ''. */
  readonly dueText: string;
  /** Past its date and not done. */
  readonly late: boolean;
  /** Before delivery "When M1 is done", in delivery "2 of 4 done", all done "M1 done 1 Oct". */
  readonly text: string;
  readonly items: readonly string[];
}

const closedDay = (model: Model, id: string): string => {
  const at = model.statusOf(id)?.closed_at;
  return at === null || at === undefined ? '' : isoDay(at);
};

/** The latest day any of these work items was closed. */
function lastClosed(model: Model, items: readonly { readonly id: string }[]): string | null {
  const days = items.map((w) => closedDay(model, w.id)).filter((d) => d !== '');
  return days.toSorted((a, b) => a.localeCompare(b)).at(-1) ?? null;
}

function stateText(
  parts: {
    readonly short: string;
    readonly done: number;
    readonly total: number;
    readonly started: boolean;
  },
  closed: string | null,
  today: Date | undefined,
): string {
  const { short, done, total, started } = parts;
  if (started && total > 0 && done === total) {
    const on = closed === null ? '' : ` ${shortDate(closed, today)}`;
    return `${short} done${on}`;
  }
  return started && total > 0
    ? `${String(done)} of ${String(total)} done`
    : `When ${short} is done`;
}

/** A day before today; never when today is not known. */
const beforeToday = (day: string, today: Date | undefined): boolean =>
  today !== undefined && day.localeCompare(isoDay(today.toISOString())) < 0;

/** Where a milestone stands; null for an id the plan does not have. */
export function msState(
  model: Model,
  msId: string,
  today: Date | undefined,
): MilestoneState | null {
  const ms = milestoneById(model, msId);
  if (ms === undefined) return null;
  const items = workList(model).filter((w) => w.milestone === msId);
  const states = items.map((w) => wiState(model, w.id));
  const started = states.some((s) => s !== null);
  const done = states.filter((s) => s === 'done').length;
  const allDone = started && items.length > 0 && done === items.length;
  const closedAt = allDone ? lastClosed(model, items) : null;
  const due = ms.due === undefined ? null : isoDay(ms.due);
  const short = msShort(model, msId);
  return {
    id: msId,
    ms,
    short,
    title: msTitle(ms),
    total: items.length,
    done,
    started,
    allDone,
    closedAt,
    due,
    dueText: due === null ? '' : `due ${shortDate(due, today)}`,
    late: !allDone && due !== null && beforeToday(due, today),
    text: stateText({ short, done, total: items.length, started }, closedAt, today),
    items: items.map((w) => w.id),
  };
}

/** "ms:live|2 of 5 done|due 16 Oct|": id, state line, due, and "due date passed" or ''. */
export const msFacts = (st: MilestoneState): string =>
  [st.id, st.text, st.dueText, st.late ? 'due date passed' : ''].join('|');

/** What the strip form says after the name: "2 of 5 done", "done 1 Oct", or the due date. */
export function chipSummary(st: MilestoneState): string {
  if (st.allDone) return st.text.replace(`${st.short} `, '');
  return st.started && st.total > 0 ? st.text : st.dueText;
}

const SIZE_WEIGHT: Readonly<Record<string, number>> = { XS: 1, S: 2, M: 3, L: 4, XL: 5 };
const MEDIUM = 3;

/** Teams the critical path runs through, the heaviest first: the items still to do, else all of them. */
function pathTeams(model: Model, work: readonly WorkItem[]): string[] {
  const critical = criticalSet(model);
  const onPath = work.filter((w) => critical.has(w.id));
  const todo = onPath.filter((w) => wiState(model, w.id) !== 'done');
  const weight = new Map<string, number>();
  for (const w of todo.length > 0 ? todo : onPath) {
    weight.set(w.team, (weight.get(w.team) ?? 0) + (SIZE_WEIGHT[w.size ?? ''] ?? MEDIUM));
  }
  return [...weight].toSorted((a, b) => b[1] - a[1]).map(([team]) => team);
}

export interface BuildSummary {
  readonly items: readonly WorkItem[];
  readonly started: boolean;
  readonly total: number;
  readonly done: number;
  readonly todo: readonly WorkItem[];
  readonly delivered: boolean;
  readonly milestones: readonly MilestoneState[];
  /** The milestone being worked on. */
  readonly current: MilestoneState | null;
  /** What is left in it. */
  readonly left: readonly WorkItem[];
  readonly closed: string | null;
  readonly pathTeams: readonly string[];
}

/**
 * What the build comes to: counts, the milestone still being worked on and what is left in it, when it all finished,
 * and which teams the critical path runs through.
 */
export function buildSummary(model: Model, today: Date | undefined): BuildSummary {
  const items = workOrdered(model);
  const todo = items.filter((w) => wiState(model, w.id) !== 'done');
  const started = items.some((w) => wiState(model, w.id) !== null);
  const delivered = started && items.length > 0 && todo.length === 0;
  const milestones = (model.plan.milestones ?? []).flatMap(
    (m) => msState(model, m.id, today) ?? [],
  );
  const current = started ? (milestones.find((m) => !m.allDone && m.total > 0) ?? null) : null;
  return {
    items,
    started,
    total: items.length,
    done: items.length - todo.length,
    todo,
    delivered,
    milestones,
    current,
    left: current === null ? [] : todo.filter((w) => w.milestone === current.id),
    closed: delivered ? lastClosed(model, items) : null,
    pathTeams: pathTeams(model, items),
  };
}
