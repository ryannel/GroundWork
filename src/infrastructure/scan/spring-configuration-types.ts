import 'server-only';

/** Declared source candidates; profiles, environment and Spring precedence remain unobserved. */
export interface ConfigurationBinding {
  readonly kind: 'configuration_binding';
  readonly id: string;
  readonly source: string;
  readonly format: 'java_properties' | 'yaml' | 'properties';
  readonly declared_type: string | null;
  readonly prefix: string | null;
  readonly profile: string | null;
  readonly conditions: readonly {
    readonly source: string;
    readonly owner_source: string;
    readonly annotation_type:
      | 'org.springframework.boot.autoconfigure.condition.ConditionalOnBean'
      | 'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty';
    readonly arguments: readonly { readonly name: string; readonly expression: string }[];
  }[];
  readonly properties: readonly {
    readonly key: string;
    readonly value: string | number | boolean | null;
    readonly value_kind: 'declaration' | 'literal' | 'expression' | 'unresolved';
    readonly type: string | null;
    readonly source: string;
    readonly placeholders: readonly string[];
  }[];
  readonly selectors: readonly {
    readonly source: string;
    readonly receiver_type: string;
    readonly operation: string;
    readonly property_key: string;
    readonly property_source: string;
  }[];
  readonly factories: readonly {
    readonly source: string;
    readonly name: string;
    readonly return_type: string;
    readonly parameter_sources: readonly string[];
    readonly call_binding_ids: readonly string[];
  }[];
  readonly completeness: 'partial';
  readonly gaps: readonly string[];
}
