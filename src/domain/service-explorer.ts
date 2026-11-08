type ExplorerFlowKind = 'entry' | 'branch' | 'call' | 'return' | 'failure';
type ExplorerBoundaryKind = 'component' | 'storage' | 'message' | 'async' | 'schema';

/** Disposable, bounded visual/query projection. Evidence remains in the selected scan snapshots. */
export interface ExplorerSource {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}
export interface ExplorerNode {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly kind: ExplorerFlowKind | ExplorerBoundaryKind;
  readonly sourceIds: readonly string[];
  readonly target: string | null;
}
export interface ExplorerLink {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly kind: 'control' | 'branch' | 'failure' | 'async' | 'data' | 'interaction';
  readonly sourceIds: readonly string[];
}
export interface ExplorerField {
  readonly name: string;
  readonly type: string;
  readonly required: 'yes' | 'no' | 'unknown';
  readonly nullable: 'yes' | 'no' | 'unknown';
  readonly sourceIds: readonly string[];
}
export interface ExplorerPage {
  readonly format: 'service-explorer-page/v1';
  readonly snapshot: string;
  readonly kind: 'overview' | 'flow' | 'data' | 'callers';
  readonly title: string;
  readonly description: string;
  readonly nodes: readonly ExplorerNode[];
  readonly links: readonly ExplorerLink[];
  readonly fields: readonly ExplorerField[];
  readonly sources: readonly ExplorerSource[];
  readonly gaps: readonly string[];
  readonly completeSelection: boolean;
  readonly incoming?: string | undefined;
}
export interface ExplorerService {
  readonly id: string;
  readonly name: string;
  readonly repo: string;
  readonly commit: string;
  readonly purpose: {
    readonly label: 'Inferred';
    readonly statement: string;
    readonly confidence: 'low' | 'medium' | 'high';
    readonly claim: string;
  };
  readonly overview: string;
  readonly callers: string;
  /** A captured repository is not assumed to be one deployed service. */
  readonly scope?: 'repository' | undefined;
  readonly sourceIndex?: string | undefined;
  readonly interpretationIndex?: string | undefined;
  readonly entryCount?: number | undefined;
  readonly entries: readonly {
    readonly id: string;
    readonly label: string;
    readonly file: string;
  }[];
}
export interface ExplorerManifest {
  readonly format: 'service-explorer/v1';
  readonly workspace: string;
  readonly snapshot: string;
  readonly services: readonly ExplorerService[];
  readonly artifacts: readonly ExplorerArtifact[];
  readonly artifactIndexes?: readonly ExplorerArtifactIndex[] | undefined;
}

export interface ExplorerArtifact {
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly pack?:
    { readonly file: string; readonly bytes: number; readonly sha256: string } | undefined;
}
export interface ExplorerArtifactIndex extends ExplorerArtifact {
  readonly bucket: string;
}
