import 'server-only';

export interface OutboundBinding {
  readonly kind: 'outbound_binding';
  readonly id: string;
  readonly source: string;
  readonly owner_source: string;
  readonly client: {
    readonly type: string;
    readonly receiver_source: string;
    readonly logical_name: string | null;
    readonly registry_source: string | null;
  };
  readonly request: {
    readonly method: string;
    readonly method_source: string;
    readonly uri_source: string;
    readonly template: string | null;
    readonly argument_sources: readonly string[];
    readonly headers: readonly {
      readonly name: string | null;
      readonly source: string;
      readonly value_sources: readonly string[];
    }[];
    readonly accept_sources: readonly string[];
    readonly body_sources: readonly string[];
  };
  readonly response: {
    readonly type: string | null;
    readonly type_source: string | null;
    readonly body_source: string;
    readonly return_sources: readonly string[];
  };
  readonly failure_paths: readonly {
    readonly caught_type: string;
    readonly source: string;
    readonly thrown_type: string | null;
    readonly thrown_source: string | null;
  }[];
  readonly call_binding_ids: readonly string[];
  readonly value_binding_ids: readonly string[];
  readonly support: readonly string[];
  readonly completeness: 'source_path' | 'partial';
  readonly gaps: readonly string[];
}
