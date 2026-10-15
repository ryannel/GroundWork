// A work item as a GitHub issue: its sections, and the Markdown body in the layout of an issue template.

import { notesOf } from '@/application/plan/issue-notes';
import {
  acceptanceOf,
  howOf,
  summaryOf,
  whyOf,
  type IssueModel,
} from '@/application/plan/issue-parts';
import {
  builtinTemplate,
  fillIssueTemplate,
  type IssueSections,
  type IssueTemplate,
} from '@/application/plan/issue-templates';
import type { Change, WorkItem } from '@/domain/plan/plan.generated';

export interface IssueOptions {
  today?: Date | string | undefined;
  /** Defaults to the built-in template for the item's issue_type. */
  template?: Pick<IssueTemplate, 'fields'> | null | undefined;
}

const workItemOf = (model: IssueModel, id: string): WorkItem | undefined =>
  model.plan.work_items?.find((w) => w.id === id);

/** The sections of a work item's issue; null when the item does not exist. */
export function issueSections(
  model: IssueModel,
  wiId: string,
  opts: Pick<IssueOptions, 'today'> = {},
): Required<IssueSections> | null {
  const wi = workItemOf(model, wiId);
  if (wi === undefined) return null;
  const ms = model.plan.milestones?.find((m) => m.id === wi.milestone);
  const changes = wi.implements.map((id): [string, Change | undefined] => [
    id,
    model.plan.changes?.find((c) => c.id === id),
  ]);
  return {
    summary: summaryOf(model, wi, ms),
    why: whyOf(model, changes, ms),
    how: howOf(model, changes),
    acceptance: acceptanceOf(model, wi),
    notes: notesOf(model, wi, opts.today),
  };
}

/** The Markdown issue body for a work item; '' when the item does not exist. */
export function issueMarkdown(model: IssueModel, wiId: string, opts: IssueOptions = {}): string {
  const sections = issueSections(model, wiId, opts);
  const wi = workItemOf(model, wiId);
  if (sections === null || wi === undefined) return '';
  return fillIssueTemplate(opts.template ?? builtinTemplate(wi), sections);
}
