/** GitHub issue state of one work item, as written to plans/<slug>/status.json. */
export interface IssueState {
  state: 'open' | 'closed';
  closed_at?: string | undefined;
  url?: string | undefined;
}

export type IssueStatus = Record<string, IssueState>;
