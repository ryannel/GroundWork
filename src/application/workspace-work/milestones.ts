import { gapDays, rollUpCommitment, type CommitmentState } from '@/application/plan/work-standing';
import { thingHref } from '@/application/plan-pages-things';
import { shortDate } from '@/application/plan-viz-state';
import { issueUrlOf } from '@/domain/code-links';
import { qualifyId } from '@/domain/ids';
import type { ProgressEvent } from '@/domain/plan/plan.generated';

import { gapText, sourceWord, stateWord, type WorkCardVM } from './work-card';
import type { IndexedWork, WorkspacePlanIndex } from './workspace-plan-index';

// What the pages about many plans say of a milestone and of what happened: shared by the partner and programme pages.

export interface MilestoneVM {
  readonly key: string;
  readonly id: string;
  /** The plan or programme it belongs to. */
  readonly scope: string;
  readonly name: string;
  readonly href: string;
  readonly neededBy: string | null;
  readonly promisedFor: string | null;
  readonly gapDays: number | null;
  readonly gapText: string | null;
  /** What its teams have promised, rolled up, in words; null when nothing is said. */
  readonly commitment: string | null;
}

export interface EventVM {
  readonly at: string;
  readonly plan: string;
  readonly subject: string;
  readonly subjectLabel: string;
  readonly href: string;
  /** "commitment accepted", "work in progress", "note". */
  readonly what: string;
  readonly by: string | null;
  readonly source: string;
  readonly url: string | null;
  readonly note: string | null;
}

/** The earliest of some dates, or the latest; null when there are none. */
export function firstDate(dates: readonly (string | null)[], last = false): string | null {
  const known = dates.filter((d) => d !== null).toSorted((a, b) => a.localeCompare(b));
  return (last ? known.at(-1) : known[0]) ?? null;
}

const isCommitment = (state: string | null): state is CommitmentState =>
  state === 'proposed' || state === 'accepted' || state === 'declined' || state === 'withdrawn';

/** Roll the commitments of some milestones up, in words. */
export function rolledUp(states: readonly (string | null)[]): string | null {
  const rolled = rollUpCommitment(
    null,
    states.map((s) => (isCommitment(s) ? s : null)),
  );
  return rolled === null ? null : stateWord(rolled);
}

/** A milestone's dates and promise from its own and its items' standing. */
export function milestoneVM(
  index: WorkspacePlanIndex,
  plan: string,
  id: string,
  items: readonly IndexedWork[],
): MilestoneVM {
  const standing = index.plans.get(plan)?.standing.milestones.find((m) => m.milestone.id === id);
  const neededBy =
    standing?.dates.neededBy ?? firstDate(items.map((w) => w.standing.dates.neededBy));
  const promisedFor =
    standing?.dates.promisedFor ??
    firstDate(
      items.map((w) => w.standing.dates.promisedFor),
      true,
    );
  const gap = gapDays(promisedFor, neededBy);
  return {
    key: qualifyId(plan, id),
    id,
    scope: plan,
    name: standing?.milestone.name ?? id,
    href: thingHref({ workspace: index.workspace, slug: plan }, id),
    neededBy,
    promisedFor,
    gapDays: gap,
    gapText: gapText(gap),
    commitment: rolledUp([standing?.rollup ?? null]),
  };
}

function labelIn(index: WorkspacePlanIndex, plan: string, subject: string): string {
  const work = index.work.get(qualifyId(plan, subject));
  if (work !== undefined) return work.card.title;
  const ms = index.plans.get(plan)?.milestones.find((m) => m.id === subject);
  return ms?.name ?? subject;
}

function eventUrl(event: ProgressEvent): string | null {
  const { source } = event;
  if (source === undefined) return null;
  if (source.url !== undefined) return source.url;
  return source.repo === undefined || source.issue === undefined
    ? null
    : issueUrlOf(source.repo, source.issue);
}

/** One event, worded, newest first when sorted with byNewest. */
export function eventVM(index: WorkspacePlanIndex, plan: string, event: ProgressEvent): EventVM {
  const what = event.state === undefined ? event.kind : `${event.kind} ${stateWord(event.state)}`;
  const url = eventUrl(event);
  return {
    at: event.at,
    plan,
    subject: event.subject,
    subjectLabel: labelIn(index, plan, event.subject),
    href: thingHref({ workspace: index.workspace, slug: plan }, event.subject),
    what,
    by: event.said_by ?? null,
    source: sourceWord(event.source?.kind ?? null),
    url,
    note: event.note ?? event.source?.note ?? null,
  };
}

/** The first of some comparisons that tells two apart. */
export const firstOrder = (orders: readonly number[]): number => orders.find((n) => n !== 0) ?? 0;

export const byNewest = (a: EventVM, b: EventVM): number =>
  firstOrder([
    b.at.localeCompare(a.at),
    a.plan.localeCompare(b.plan),
    a.subject.localeCompare(b.subject),
  ]);

export type CardsByMilestone = readonly {
  readonly milestone: MilestoneVM | null;
  readonly items: readonly WorkCardVM[];
}[];

/** A milestone's or an item's dates in a line: "needed by 15 Feb · promised for 1 Mar · 14 days after we need". */
export function datesWords(
  dates: {
    readonly neededBy: string | null;
    readonly promisedFor: string | null;
    readonly gapText: string | null;
  },
  today?: Date,
): string {
  return [
    dates.neededBy === null ? 'no date needed' : `needed by ${shortDate(dates.neededBy, today)}`,
    dates.promisedFor === null
      ? 'nothing promised'
      : `promised for ${shortDate(dates.promisedFor, today)}`,
    dates.gapText,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}
