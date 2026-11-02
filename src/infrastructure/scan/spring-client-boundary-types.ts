import 'server-only';

import type { OutboundBinding } from './spring-outbound-types';

interface ClientBoundary {
  readonly id: string;
  readonly source: string;
  readonly owner_source: string;
  readonly call_binding_ids: readonly string[];
  readonly value_binding_ids: readonly string[];
  readonly support: readonly string[];
  readonly completeness: 'source_path' | 'partial';
  readonly gaps: readonly string[];
}

export interface GraphqlBinding extends ClientBoundary {
  readonly kind: 'graphql_binding';
  readonly client: OutboundBinding['client'];
  readonly document_name: string | null;
  readonly document_source: string;
  readonly variables: readonly {
    readonly name: string | null;
    readonly source: string;
    readonly value_sources: readonly string[];
  }[];
  readonly execution_source: string;
  readonly response: {
    readonly field_path: string | null;
    readonly field_source: string | null;
    readonly type: string | null;
    readonly type_source: string | null;
    readonly body_source: string;
    readonly return_sources: readonly string[];
  };
  readonly failure_paths: OutboundBinding['failure_paths'];
}

export interface LibraryBinding extends ClientBoundary {
  readonly kind: 'library_binding';
  readonly owner_type: string;
  readonly method_name: string;
  readonly call_source: string;
  readonly receiver_source: string | null;
  readonly argument_sources: readonly string[];
  readonly result_type: string | null;
  readonly contract_basis: 'source_declared_type' | 'framework_api';
  readonly failure_paths: OutboundBinding['failure_paths'];
}
