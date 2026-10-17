import type { PlanDiff } from '@/application/plan/plan-diff-core';
import type { RevisionEntry } from '@/application/plan/revision-ledger';
import type { Plan } from '@/domain/plan/plan.generated';

export type HeadStatus = 'proposed' | 'approved' | 'none';

/** An earlier revision the reader switched to, as its snapshot was read. */
export interface OlderRevision {
  readonly version: string;
  readonly plan: Plan;
}

/** What the reader is looking at: the head, or a version from the ledger. */
export interface ViewedRevision {
  readonly version: string | null;
  readonly entry: RevisionEntry | null;
  readonly plan: Plan;
}

export interface HeadRevision extends ViewedRevision {
  readonly status: HeadStatus;
}

export interface ApprovedRevision {
  readonly version: string;
  readonly entry: RevisionEntry;
  readonly plan: Plan | null;
}

export interface HistoryRow {
  readonly version: string;
  readonly entry: RevisionEntry;
  readonly available: boolean;
  readonly current: boolean;
}

/** One revision with the approved revision it was proposed on. */
export interface RevisionStep {
  readonly version: string;
  readonly entry: RevisionEntry;
  readonly base: string | null;
  readonly available: boolean;
  readonly baseAvailable: boolean;
}

export interface RevisionOptions {
  /** 'head' (the default) or a ledger version the reader switched to. */
  readonly viewing?: string | null;
  /** That version's snapshot, when it is not the approved one. */
  readonly older?: OlderRevision | null;
  /** The versions that have a snapshot on disk, for the history menu. */
  readonly snapshots?: readonly string[] | null;
  /** Any other revisions already read, by version. */
  readonly plans?: Readonly<Record<string, Plan | null | undefined>> | null;
}

export interface Revision {
  readonly viewing: string;
  readonly viewed: ViewedRevision;
  readonly head: HeadRevision;
  readonly approved: ApprovedRevision | null;
  readonly ledger: readonly RevisionEntry[];
  readonly history: readonly HistoryRow[];
  /** The diff approved → proposed head; null without a proposal or without the approved snapshot. */
  readonly diff: PlanDiff | null;
  readonly steps: readonly RevisionStep[];
  /** Every revision readable here, by version. */
  readonly plans: ReadonlyMap<string, Plan>;
  /** The diff a revision makes on its base, or null when either plan is missing. */
  readonly diffOf: (version: string) => PlanDiff | null;
}
