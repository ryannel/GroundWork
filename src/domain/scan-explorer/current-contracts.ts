import type { RuntimeComponent } from '@/domain/knowledge/knowledge.generated';
import type {
  BindingRecord,
  Contract,
  FrameworkRecord,
  Gap,
  LocalSummary,
  SemanticRecord,
  Source,
} from '@/domain/scan/scan.generated';

export type CurrentRecord =
  BindingRecord | FrameworkRecord | SemanticRecord | Contract | Gap | LocalSummary | Source;

export interface DeclaredRuntimeBinding {
  readonly component: Readonly<RuntimeComponent>;
  readonly repo: string;
  readonly commit: string;
  readonly declarations: readonly Source[];
  readonly modulePaths: readonly string[];
  readonly verification: 'pinned_runtime_declaration';
  readonly limitations: readonly string[];
}

export interface CurrentScanInput {
  readonly snapshot: string;
  readonly records: readonly CurrentRecord[];
  readonly sources: readonly Source[];
  readonly binding: DeclaredRuntimeBinding;
  readonly coverage: readonly string[];
  readonly targets?: readonly CurrentTargetBinding[];
  readonly providers?: readonly {
    readonly entry: string;
    readonly protocol: string;
    readonly sourceIds: readonly string[];
    readonly canonicalEntry: string;
    readonly canonicalSnapshot?: string;
    readonly version?: string | null;
  }[];
}

export interface CurrentTargetBinding {
  readonly outbound: string;
  readonly component: string;
  readonly protocol: string;
  readonly method: string;
  readonly path: string;
  readonly sourceIds: readonly string[];
  readonly basis: 'canonical_source_correspondence';
  readonly canonicalInteraction: string;
  readonly canonicalSnapshot?: string;
  readonly componentRecord?: string;
  readonly version?: string | null;
}

export interface CurrentBounds {
  readonly limit: number;
  readonly offset?: number;
  readonly maxBytes?: number;
}

export interface CurrentView {
  readonly snapshot: string;
  readonly component: Readonly<RuntimeComponent>;
  readonly items: readonly CurrentRecord[];
  readonly sourceLinks: readonly {
    readonly id: string;
    readonly snapshot: string;
    readonly url: string;
  }[];
  readonly coverage: readonly string[];
  readonly gaps: readonly string[];
  readonly truncated: boolean;
  readonly total: number;
  readonly execution: 'source_reachability_runtime_unverified';
  readonly exhaustive: false;
  readonly deployment: 'not_verified';
  readonly nextOffset: number | null;
  readonly limitsHit: readonly ('records' | 'bytes')[];
  readonly frontiers: readonly { readonly at: string; readonly reason: string }[];
}
