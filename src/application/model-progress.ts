import type { Issue } from '@/application/plan/check-context';
import { issueStatusOf, sourceUrl } from '@/application/plan/progress';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Progress, ProgressEvent } from '@/domain/plan/plan.generated';

/** Progress keeps its independent append-only contract; it never supplies current implementation facts. */
export interface ModelPlanProgress {
  readonly events: readonly ProgressEvent[];
  readonly errors: readonly Issue[];
  readonly status: Readonly<IssueStatus>;
}
export function modelPlanProgressOf(read: {
  readonly progress: Progress;
  readonly errors: readonly Issue[];
}): ModelPlanProgress {
  return {
    events: read.progress.events,
    errors: read.errors,
    status: issueStatusOf(read.progress),
  };
}
export interface ModelProgressRecord {
  readonly subject: string;
  readonly at: string;
  readonly kind: ProgressEvent['kind'];
  readonly state: string | null;
  readonly note: string | null;
  readonly saidBy: string | null;
  readonly promisedFor: string | null;
  readonly confidence: string | null;
  readonly source: string | null;
  readonly raw: ProgressEvent;
}
const STATES: Readonly<Record<string, string>> = {
  proposed: 'Proposed',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};
/** The feed retains source order and the exact event beside its readable fields. */
export function modelProgressRecords(
  progress: ModelPlanProgress,
  subject?: string,
): readonly ModelProgressRecord[] {
  return progress.events
    .filter((event) => subject === undefined || event.subject === subject)
    .map((event) => ({
      subject: event.subject,
      at: event.at,
      kind: event.kind,
      state: event.state === undefined ? null : (STATES[event.state] ?? event.state),
      note: event.note ?? null,
      saidBy: event.said_by ?? null,
      promisedFor: event.promised_for ?? null,
      confidence: event.confidence ?? null,
      source: sourceUrl(event) ?? null,
      raw: event,
    }));
}
