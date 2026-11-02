import 'server-only';

import type { CallBinding, ValueBinding } from './java-call-binding-types';
import type { JavaUnit } from './java-declarations';
import type { SourceIndex } from './source-index-types';
import type { SpringRoute } from './spring-routes';

export interface EntryCatalogueInput {
  readonly units: readonly JavaUnit[];
  readonly indexes: readonly SourceIndex[];
  readonly routes: readonly SpringRoute[];
  readonly calls: readonly CallBinding[];
  readonly values: readonly ValueBinding[];
  readonly bindings: readonly {
    readonly kind: string;
    readonly id: string;
    readonly source?: string;
    readonly owner_source?: string;
  }[];
}
export interface SpringEntry {
  readonly id: string;
  readonly kind: 'rest' | 'kafka_consumer' | 'schedule';
  readonly binding_id: string;
  readonly declaration_source_id: string;
  readonly executable_source_id: string | null;
  readonly root_source_ids: readonly string[];
  readonly completeness: 'partial';
}
export interface EntryBoundary {
  readonly binding_id: string;
  readonly kind: 'storage' | 'outbound';
  readonly binding_kind: string;
  readonly source_id: string;
  readonly owner_source_id: string | null;
}
export interface SpringEntryCatalogue {
  readonly entries: readonly SpringEntry[];
  readonly boundaries: readonly EntryBoundary[];
  readonly quarantined_paths: readonly string[];
  readonly completeness: 'partial';
  readonly gaps: readonly string[];
}
export interface EntryQueryLimits {
  readonly maxOwners: number;
  readonly maxCalls: number;
  readonly maxFields: number;
  readonly maxDepth: number;
  readonly maxSyntaxNodes: number;
  readonly maxFrontiers: number;
}
export interface EntryQueryFrontier {
  readonly kind: 'unresolved_call' | 'missing_declaration' | 'budget' | 'deferred_execution';
  readonly source_id: string;
  readonly binding_id: string | null;
  readonly reason: string;
}
export interface SpringEntryQueryPlan {
  readonly entry_id: string;
  readonly root_source_ids: readonly string[];
  readonly owner_source_ids: readonly string[];
  readonly field_source_ids: readonly string[];
  readonly call_binding_ids: readonly string[];
  readonly boundary_binding_ids: readonly string[];
  readonly frontiers: readonly EntryQueryFrontier[];
  readonly limits: EntryQueryLimits;
  readonly selected_syntax_nodes: number;
  readonly omitted_frontiers: number;
  readonly completeness: 'partial';
  readonly execution: 'source_reachability_runtime_unverified';
}
