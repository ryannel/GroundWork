import type { PlanDiff } from '@/application/plan/plan-diff-core';
import type { RevisionEntry } from '@/application/plan/revision-ledger';
import type { Plan } from '@/domain/plan/plan.generated';

export type HeadStatus = 'proposed' | 'approved' | 'none';

/** An earlier revision the reader switched to, as its snapshot was read. */
export interface OlderRevision {
  version: string;
  plan: Plan;
}

/** What the reader is looking at: the head, or a version from the ledger. */
export interface ViewedRevision {
  version: string | null;
  entry: RevisionEntry | null;
  plan: Plan;
}

export interface HeadRevision extends ViewedRevision {
  status: HeadStatus;
}

export interface ApprovedRevision {
  version: string;
  entry: RevisionEntry;
  plan: Plan | null;
}

export interface HistoryRow {
  version: string;
  entry: RevisionEntry;
  available: boolean;
  current: boolean;
}

/** One revision with the approved revision it was proposed on. */
export interface RevisionStep {
  version: string;
  entry: RevisionEntry;
  base: string | null;
  available: boolean;
  baseAvailable: boolean;
}

export interface RevisionOptions {
  /** 'head' (the default) or a ledger version the reader switched to. */
  viewing?: string | null;
  /** That version's snapshot, when it is not the approved one. */
  older?: OlderRevision | null;
  /** The versions that have a snapshot on disk, for the history menu. */
  snapshots?: readonly string[] | null;
  /** Any other revisions already read, by version. */
  plans?: Readonly<Record<string, Plan | null | undefined>> | null;
}

export interface Revision {
  viewing: string;
  viewed: ViewedRevision;
  head: HeadRevision;
  approved: ApprovedRevision | null;
  ledger: RevisionEntry[];
  history: HistoryRow[];
  /** The diff approved → proposed head; null without a proposal or without the approved snapshot. */
  diff: PlanDiff | null;
  steps: RevisionStep[];
  /** Every revision readable here, by version. */
  plans: Map<string, Plan>;
  /** The diff a revision makes on its base, or null when either plan is missing. */
  diffOf: (version: string) => PlanDiff | null;
}
