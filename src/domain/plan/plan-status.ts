/** GitHub issue state of one work item: the latest event the GitHub sync recorded in plans/<slug>/progress.yaml. */
export interface IssueState {
  readonly state: 'open' | 'closed';
  readonly closed_at?: string | undefined;
  readonly url?: string | undefined;
}

export type IssueStatus = Record<string, IssueState>;
