import type { Issue } from '@/application/plan/check-context';
import { formatPath } from '@/application/plan/ids';
import { issueUrlOf } from '@/domain/code-links';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Progress, ProgressEvent } from '@/domain/plan/plan.generated';

// plans/<plan>/progress.yaml: an append-only record of what happened to the plan's work items and milestones,
// each event with who said it and where. Commitment (what a team promised) and work (what has happened) are
// kept apart; a note carries neither.

type Kind = ProgressEvent['kind'];
type State = NonNullable<ProgressEvent['state']>;

const STATES: Readonly<Record<Kind, readonly State[]>> = {
  commitment: ['proposed', 'accepted', 'declined', 'withdrawn'],
  work: ['not_started', 'in_progress', 'blocked', 'done'],
  note: [],
};

const said = (states: readonly State[]): string =>
  states.length === 0 ? 'none' : states.join(', ');

const at = (...segs: readonly string[]): string => formatPath(segs);

function eventProblems(event: ProgressEvent, subjects: ReadonlySet<string>): Issue[] {
  const allowed = STATES[event.kind];
  const problems: Issue[] = [];
  if (!subjects.has(event.subject)) {
    problems.push({
      path: at('subject'),
      message: `${event.subject} is no work item or milestone of this plan; fix the id`,
    });
  }
  if (event.state !== undefined && !allowed.includes(event.state)) {
    problems.push({
      path: at('state'),
      message: `a ${event.kind} event cannot be ${event.state}; its states are ${said(allowed)}`,
    });
  }
  if (event.kind === 'work' && event.state === undefined) {
    problems.push({ path: at('state'), message: `a work event says its state: ${said(allowed)}` });
  }
  const promise = [event.promised_for, event.confidence].some((v) => v !== undefined && v !== null);
  if (event.kind !== 'commitment' && promise) {
    problems.push({
      path: at('promised_for'),
      message: 'only a commitment carries a promised date or a confidence',
    });
  }
  return problems;
}

/** The parts of a plan its progress record is about: its work items and milestones, by id. */
export interface ProgressSubjects {
  readonly work_items?: readonly { readonly id: string }[] | undefined;
  readonly milestones?: readonly { readonly id: string }[] | undefined;
}

/** What is wrong with a plan's progress record: subjects it does not have, states that do not fit their kind. */
export function checkProgress(plan: ProgressSubjects, progress: Progress): Issue[] {
  const subjects = new Set([
    ...(plan.work_items ?? []).map((w) => w.id),
    ...(plan.milestones ?? []).map((m) => m.id),
  ]);
  return progress.events.flatMap((event, i) =>
    eventProblems(event, subjects).map((problem) => ({
      path: `events[${String(i)}].${problem.path}`,
      message: problem.message,
    })),
  );
}

/** Where an event's evidence is: its link, or the GitHub issue it names. */
export const sourceUrl = (event: ProgressEvent): string | undefined => {
  const { url, repo, issue } = event.source ?? {};
  if (url !== undefined) return url;
  return repo === undefined || issue === undefined ? undefined : issueUrlOf(repo, issue);
};

/** Is `event` at least as late as `before`? Equal times go to the one recorded later, which comes last. */
const notEarlier = (before: ProgressEvent | undefined, event: ProgressEvent): boolean =>
  before === undefined || before.at.localeCompare(event.at) <= 0;

/** The latest event that passes `keep`: the latest `at`, and of equal times the one recorded last. */
export function latestEvent(
  events: readonly ProgressEvent[],
  keep: (event: ProgressEvent) => boolean,
): ProgressEvent | null {
  let found: ProgressEvent | undefined;
  for (const event of events) {
    if (keep(event) && notEarlier(found, event)) found = event;
  }
  return found ?? null;
}

const isGithubWork = (event: ProgressEvent): boolean =>
  event.kind === 'work' && event.source?.kind === 'github';

/** What appending an event did: the record after it, or why it was left out. */
export type Appended =
  | { readonly appended: true; readonly progress: Progress }
  | { readonly appended: false; readonly problems: readonly Issue[]; readonly unchanged: boolean };

/**
 * The record with one more event, checked like the whole record. A GitHub work event that says what the latest
 * GitHub event for its subject already says is left out, so the sync can run as often as it likes.
 */
export function appendEvent(
  plan: ProgressSubjects,
  progress: Progress,
  event: ProgressEvent,
): Appended {
  if (isGithubWork(event)) {
    const before = latestEvent(
      progress.events,
      (each) => each.subject === event.subject && isGithubWork(each),
    );
    if (before?.state === event.state) return { appended: false, problems: [], unchanged: true };
  }
  const next: Progress = { events: [...progress.events, event] };
  const problems = checkProgress(plan, next).filter((problem) =>
    problem.path.startsWith(`events[${String(progress.events.length)}]`),
  );
  return problems.length === 0
    ? { appended: true, progress: next }
    : { appended: false, problems, unchanged: false };
}

/**
 * The GitHub issue state of each work item, from the latest event the GitHub sync recorded for it: done is a closed
 * issue, any other state an open one.
 */
export function issueStatusOf(progress: Progress): IssueStatus {
  const latest = new Map<string, ProgressEvent>();
  for (const event of progress.events) {
    if (isGithubWork(event) && notEarlier(latest.get(event.subject), event)) {
      latest.set(event.subject, event);
    }
  }
  const status: IssueStatus = {};
  for (const [subject, event] of latest) {
    const url = sourceUrl(event);
    const closed = event.state === 'done';
    status[subject] = {
      state: closed ? 'closed' : 'open',
      ...(closed ? { closed_at: event.at } : {}),
      ...(url === undefined ? {} : { url }),
    };
  }
  return status;
}
