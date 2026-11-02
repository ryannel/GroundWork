import 'server-only';

import type { ConfigurationBinding } from './spring-configuration-types';

export interface AsyncBinding {
  readonly kind: 'async_binding';
  readonly id: string;
  readonly source: string;
  readonly owner_source: string;
  readonly owner_type: string;
  readonly annotation_source: string;
  readonly conditions: ConfigurationBinding['conditions'];
  readonly executor: string | null;
  readonly activation_sources: readonly string[];
  readonly executor_sources: readonly string[];
  readonly activation: 'declared_runtime_unverified';
  readonly return_type: string;
  readonly completion: 'void' | 'future' | 'unknown';
  readonly invocations: readonly {
    readonly call_source: string;
    readonly owner_source: string | null;
    readonly call_binding_id: string;
    readonly dispatch: 'direct_self' | 'receiver_proxy_unverified';
    readonly use: 'ignored' | 'returned' | 'joined' | 'bound' | 'unknown';
    readonly use_source: string;
  }[];
  readonly call_binding_ids: readonly string[];
  readonly value_binding_ids: readonly string[];
  readonly support: readonly string[];
  readonly completeness: 'partial';
  readonly gaps: readonly string[];
}

export interface ExecutionBinding {
  readonly kind: 'execution_binding';
  readonly id: string;
  readonly source: string;
  readonly owner_source: string;
  readonly owner_type: string;
  readonly call_results: readonly {
    readonly call_source: string;
    readonly call_binding_id: string;
    readonly use: 'ignored' | 'returned' | 'joined' | 'bound' | 'unknown';
    readonly use_source: string;
  }[];
  readonly return_sources: readonly string[];
  readonly throw_sources: readonly string[];
  readonly catch_sources: readonly string[];
  readonly finally_sources: readonly string[];
  readonly transaction_sources: readonly string[];
  readonly transaction: 'declared_runtime_unverified' | 'none_in_selected_declaration';
  readonly failure: 'source_paths_only';
  readonly completion: 'source_returns_only';
  readonly call_binding_ids: readonly string[];
  readonly value_binding_ids: readonly string[];
  readonly support: readonly string[];
  readonly completeness: 'partial';
  readonly gaps: readonly string[];
}
