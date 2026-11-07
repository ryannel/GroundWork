import type { PlanBrief } from '@/application/workspace-library-plans';

export interface DomainLink {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly systems: string;
}

export interface WorkspaceCard {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly description: string | null;
  readonly isPrivate: boolean;
  readonly isExample: boolean;
  readonly location: {
    readonly folder: string;
    readonly repo: string | null;
    readonly source: string;
  } | null;
  /** Its size, as short facts: "3 domains", "14 systems". */
  readonly facts: readonly string[];
  readonly domains: readonly DomainLink[];
  /** The plans someone should look at first; `morePlans` more are on the workspace page. */
  readonly plans: readonly PlanBrief[];
  readonly morePlans: number;
  readonly plansHref?: string;
}

export interface Library {
  readonly cards: readonly WorkspaceCard[];
  readonly pending?: readonly { readonly id: string; readonly name: string }[];
}

export interface WorkspaceLink {
  readonly id: string;
  readonly folder: string;
  readonly source: 'example' | 'local' | 'environment';
  readonly isExample: boolean;
  readonly repo: string | null;
}

const LINK_SOURCES: Record<WorkspaceLink['source'], string> = {
  example: 'Bundled example',
  local: 'groundwork.local.yaml',
  environment: 'GROUNDWORK_WORKSPACES',
};

export function workspaceLocationOf(
  link: WorkspaceLink | undefined,
  local: boolean,
): WorkspaceCard['location'] {
  return !local || link === undefined
    ? null
    : { folder: link.folder, repo: link.repo, source: LINK_SOURCES[link.source] };
}
