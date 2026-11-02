import 'server-only';

/** Source listener declarations and bounded source execution; no effective broker/runtime claims. */
export interface ConsumerBinding {
  readonly kind: 'consumer_binding';
  readonly id: string;
  readonly source: string;
  readonly owner_source: string;
  readonly owner_type: string;
  readonly annotation_source: string;
  readonly conditions: readonly {
    readonly source: string;
    readonly owner_source: string;
    readonly annotation_type:
      | 'org.springframework.boot.autoconfigure.condition.ConditionalOnBean'
      | 'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty';
    readonly arguments: readonly { readonly name: string; readonly expression: string }[];
  }[];
  readonly selectors: readonly {
    readonly role:
      | 'topics'
      | 'topicPattern'
      | 'topicPartitions'
      | 'groupId'
      | 'containerFactory'
      | 'batch'
      | 'autoStartup'
      | 'properties';
    readonly expression: string;
    readonly source: string;
    readonly literal: string | null;
  }[];
  readonly parameters: readonly {
    readonly source: string;
    readonly type: string;
    readonly payload_annotation_source: string | null;
  }[];
  readonly factory_candidates: readonly {
    readonly source: string;
    readonly annotation_source: string;
    readonly return_type: string;
    readonly selection: 'source_name_candidate';
  }[];
  readonly deserialisations: readonly {
    readonly source: string;
    readonly owner_source: string;
    readonly receiver_type: string;
    readonly argument_sources: readonly string[];
    readonly return_type: string;
    readonly type_reference_sources: readonly string[];
  }[];
  readonly model_declarations: readonly {
    readonly source: string;
    readonly type: string;
    readonly field_sources: readonly string[];
  }[];
  readonly calls: readonly {
    readonly call_binding_id: string;
    readonly source: string;
    readonly owner_source: string | null;
    readonly target_source: string | null;
    readonly operation: string;
    readonly receiver_type: string | null;
    readonly argument_sources: readonly string[];
    readonly execution: 'direct_source' | 'async_declared' | 'deferred_source';
  }[];
  readonly candidate_helpers: readonly {
    readonly call_source: string;
    readonly target_source: string;
    readonly argument_sources: readonly string[];
    readonly parameter_sources: readonly string[];
    readonly resolution: 'nominal_source_candidate';
  }[];
  readonly return_sources: readonly string[];
  readonly throw_sources: readonly string[];
  readonly catch_sources: readonly string[];
  readonly call_binding_ids: readonly string[];
  readonly value_binding_ids: readonly string[];
  readonly support: readonly string[];
  readonly activation: 'declared_runtime_unverified';
  readonly acknowledgement: 'unobserved';
  readonly retry: 'unobserved';
  readonly completeness: 'partial';
  readonly gaps: readonly string[];
}
