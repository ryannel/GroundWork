import 'server-only';

export interface SpringExceptionHandler {
  readonly advice: string;
  readonly advice_source_id: string;
  readonly handler_source_id: string;
  readonly handled_type: string;
  readonly scope: 'global' | 'unresolved';
  readonly response_status?: string;
  readonly response_return_source_ids: readonly string[];
  readonly response_construction_owners: readonly {
    readonly source_id: string;
    readonly owner_method_source_id: string;
  }[];
  readonly response_construction_source_ids: readonly string[];
  readonly support_source_ids: readonly string[];
}

/** Source-declared selection; invocation propagation and deployment are separate obligations. */
export interface SpringExceptionBinding {
  readonly kind: 'exception_binding';
  readonly id: string;
  readonly source_ids: readonly string[];
  readonly thrown_type: string;
  readonly throw_source_id: string;
  readonly throwing_method_source_id: string;
  readonly constructor_argument_source_ids: readonly string[];
  readonly guard_source_ids: readonly string[];
  readonly enclosing_try_source_ids: readonly string[];
  readonly local_controller_handler_source_ids: readonly string[];
  readonly candidates: readonly SpringExceptionHandler[];
  readonly resolution: 'resolved' | 'unresolved';
  readonly uncertainties: readonly string[];
}
