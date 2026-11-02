import 'server-only';

import type { OutboundBinding } from './spring-outbound-types';

/** Source construction and SDK arguments, without a claim about broker delivery or wire codecs. */
export interface EventBinding {
  readonly kind: 'event_binding';
  readonly id: string;
  readonly source: string;
  readonly owner_source: string;
  readonly client: { readonly type: string; readonly receiver_source: string };
  readonly operation: string;
  readonly contract: 'spring_kafka' | 'external_sdk_source';
  readonly arguments: readonly {
    readonly position: number;
    readonly role: string;
    readonly source: string;
    readonly type: string | null;
  }[];
  readonly candidate_helpers: readonly {
    readonly call_source: string;
    readonly target_source: string;
    readonly argument_sources: readonly string[];
    readonly parameter_sources: readonly string[];
    readonly resolution: 'source_candidate';
  }[];
  readonly constructions: readonly {
    readonly source: string;
    readonly type: string | null;
    readonly argument_sources: readonly string[];
    readonly fields: readonly {
      readonly field: string;
      readonly field_source: string;
      readonly value_source: string;
    }[];
  }[];
  /** Source method applications; external builder and envelope semantics remain unverified. */
  readonly builder_calls: readonly {
    readonly source: string;
    readonly operation: string;
    readonly receiver_source: string;
    readonly argument_sources: readonly string[];
  }[];
  readonly selectors: readonly {
    readonly source: string;
    readonly receiver_type: string | null;
    readonly operation: string;
    readonly target_source: string | null;
  }[];
  /** Source IF declarations in the bounded method closure; not a dominance claim. */
  readonly conditions: readonly {
    readonly source: string;
    readonly condition_source: string;
    readonly consequent_source: string | null;
    readonly alternative_source: string | null;
    readonly return_sources: readonly string[];
  }[];
  readonly comparisons: readonly {
    readonly source: string;
    readonly operator: string;
    readonly operand_sources: readonly string[];
  }[];
  readonly result_observation: 'discarded' | 'returned' | 'assigned' | 'composed';
  readonly failure_paths: OutboundBinding['failure_paths'];
  readonly call_binding_ids: readonly string[];
  readonly value_binding_ids: readonly string[];
  readonly support: readonly string[];
  readonly completeness: 'partial';
  readonly gaps: readonly string[];
}
