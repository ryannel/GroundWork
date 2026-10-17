/** GitHub issue state of one work item, as written to plans/<slug>/status.json. */
export interface IssueState {
  readonly state: 'open' | 'closed';
  readonly closed_at?: string | undefined;
  readonly url?: string | undefined;
}

export type IssueStatus = Record<string, IssueState>;
