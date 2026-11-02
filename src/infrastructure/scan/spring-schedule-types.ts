import 'server-only';

import type { AsyncBinding } from './spring-async-types';
import type { ConfigurationBinding } from './spring-configuration-types';

export interface ScheduleDeclaration {
  readonly source: string;
  readonly owner_source: string;
  readonly annotation_type:
    | 'org.springframework.scheduling.annotation.Scheduled'
    | 'net.javacrumbs.shedlock.spring.annotation.SchedulerLock'
    | 'org.springframework.scheduling.annotation.EnableScheduling'
    | 'net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock';
  readonly arguments: readonly { readonly name: string; readonly expression: string }[];
}

/** Source declarations and exact invocation joins; effective scheduling remains unobserved. */
export interface ScheduleBinding {
  readonly kind: 'schedule_binding';
  readonly id: string;
  readonly source: string;
  readonly owner_source: string;
  readonly owner_type: string;
  readonly annotations: readonly ScheduleDeclaration[];
  readonly conditions: ConfigurationBinding['conditions'];
  readonly activation_declarations: readonly ScheduleDeclaration[];
  readonly lock_provider_sources: readonly string[];
  readonly async_invocations: readonly (AsyncBinding['invocations'][number] & {
    readonly async_binding_id: string;
  })[];
  readonly call_binding_ids: readonly string[];
  readonly value_binding_ids: readonly string[];
  readonly support: readonly string[];
  readonly activation: 'declared_runtime_unverified';
  readonly lock_scope: 'scheduled_invocation_only_async_completion_unverified';
  readonly completeness: 'partial';
  readonly gaps: readonly string[];
}
