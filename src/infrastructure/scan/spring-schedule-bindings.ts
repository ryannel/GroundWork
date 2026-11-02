import 'server-only';

import { declarationSource } from './java-declaration-parts';
import type { JavaMethod, JavaType } from './java-declarations';
import { methodValues } from './spring-async-execution';
import { asyncOwnedNodes } from './spring-async-source';
import type { AsyncBinding } from './spring-async-types';
import { configurationConditions } from './spring-configuration-conditions';
import type { OutboundInput } from './spring-outbound-provenance';
import {
  scheduleActivation,
  scheduleDeclarations,
  scheduleProviders,
} from './spring-schedule-source';
import type { ScheduleBinding } from './spring-schedule-types';

interface ScheduleInput extends OutboundInput {
  readonly async_bindings: readonly AsyncBinding[];
}

function scheduleCalls(input: ScheduleInput, method: JavaMethod): OutboundInput['calls'] {
  const sources = new Set(
    input.indexes.flatMap((index) =>
      asyncOwnedNodes(index, method).map((node) => declarationSource(index, node)),
    ),
  );
  return input.calls.filter((call) => sources.has(call.call));
}

function asyncInvocations(
  input: ScheduleInput,
  method: JavaMethod,
): ScheduleBinding['async_invocations'] {
  return input.async_bindings.flatMap((binding) =>
    binding.invocations
      .filter((invocation) => invocation.owner_source === method.source)
      .map((invocation) => ({ ...invocation, async_binding_id: binding.id })),
  );
}

function scheduleBinding(
  input: ScheduleInput,
  owner: JavaType,
  method: JavaMethod,
): ScheduleBinding {
  const annotations = scheduleDeclarations(method);
  const conditions = [...configurationConditions(owner), ...configurationConditions(method)];
  const activation = scheduleActivation(input);
  const providers = scheduleProviders(input);
  const invocations = asyncInvocations(input, method);
  const calls = scheduleCalls(input, method);
  const support = [
    ...new Set([
      owner.source,
      method.source,
      ...annotations.map((entry) => entry.source),
      ...conditions.map((entry) => entry.source),
      ...activation.flatMap((entry) => [entry.source, entry.owner_source]),
      ...providers,
      ...calls.map((call) => call.call),
      ...invocations.flatMap((entry) => [entry.call_source, entry.use_source]),
    ]),
  ];
  return {
    kind: 'schedule_binding',
    id: `schedule:${method.source}`,
    source: method.source,
    owner_source: owner.source,
    owner_type: owner.qualifiedName,
    annotations,
    conditions,
    activation_declarations: activation,
    lock_provider_sources: providers,
    async_invocations: invocations,
    call_binding_ids: calls.map((call) => call.id),
    value_binding_ids: methodValues(input, new Set(support)),
    support,
    activation: 'declared_runtime_unverified',
    lock_scope: 'scheduled_invocation_only_async_completion_unverified',
    completeness: 'partial',
    gaps: [
      'Scheduling, lock and condition declarations do not establish effective activation, configuration precedence, bean selection or proxy interception.',
      'Lock provider methods are nominal source candidates; inherited, external and effective providers remain unresolved.',
      'The scheduled invocation lock does not establish coverage of a dispatched async body or global concurrency; task submission, executor scope and completion remain runtime unverified.',
      'Only directly declared Scheduled annotations are selected; inherited, composed and repeatable container declarations remain unresolved.',
    ],
  };
}

/** Reuse shared call/value and async relations; deferred bodies keep their own executable owner. */
export function collectScheduleBindings(input: ScheduleInput): readonly ScheduleBinding[] {
  return input.units.flatMap((unit) =>
    unit.types.flatMap((owner) =>
      owner.methods.filter(isScheduled).map((method) => scheduleBinding(input, owner, method)),
    ),
  );
}

function isScheduled(method: JavaMethod): boolean {
  return method.annotations.some(
    (entry) => entry.name === 'org.springframework.scheduling.annotation.Scheduled',
  );
}
