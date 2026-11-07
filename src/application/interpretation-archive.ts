import { workspaceHref } from './workspace-paths';

export interface ArchiveScope {
  readonly repo: string;
  readonly commit: string;
}

export interface ArchivedInterpretation {
  readonly id: string;
  readonly kind: string;
  readonly statement: string;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly reasoning: string;
  readonly limitations: readonly string[];
  readonly canonicalId: string | null;
}

export interface InterpretationArchive {
  readonly claims: readonly ArchivedInterpretation[];
  readonly contexts: readonly { readonly id: string; readonly sha256: string }[];
  readonly independentReview: boolean;
  readonly seal: boolean;
}

export function archiveHref(workspace: string, scope: ArchiveScope, claim?: string): string {
  const query = new URLSearchParams({ repo: scope.repo, commit: scope.commit });
  const fragment = claim === undefined ? '' : `#${encodeURIComponent(claim)}`;
  return `${workspaceHref(workspace)}evidence/?${query.toString()}${fragment}`;
}
