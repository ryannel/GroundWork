import type {
  JavaCallBinding,
  JavaCollectionBinding,
  JavaConstantBinding,
  JavaValueBinding,
  ScheduleBinding,
} from '@/domain/scan/scan.generated';

import { eventBindingFixture } from './scan-event-kit';

/** Bounded synthetic declarations distinguish source pins, lexical owners and shared call identities. */
export function archiveBindingFixture() {
  const fixture = eventBindingFixture();
  const { document } = fixture;
  const template = document.sources[0]!;
  const spans = [
    ['scheduled-annotation', 'Worker.java', 50, 50],
    ['lock-annotation', 'Worker.java', 51, 51],
    ['class-condition', 'Worker.java', 2, 2],
    ['enable-class', 'Config.java', 1, 30],
    ['collection', 'Worker.java', 70, 80],
    ['factory', 'Worker.java', 75, 79],
    ['constant-element', 'Worker.java', 76, 76],
    ['literal-element', 'Worker.java', 77, 77],
    ['constant', 'Worker.java', 5, 6],
    ['constant-value', 'Worker.java', 6, 6],
  ] as const;
  document.sources.push(
    ...spans.map(([id, path, from, to]) => ({
      ...template,
      id,
      path,
      lines: [from, to] as [number, number],
    })),
  );
  fixture.async.conditions = [
    {
      source: 'class-condition',
      owner_source: 'class',
      annotation_type: 'org.springframework.boot.autoconfigure.condition.ConditionalOnBean',
      arguments: [{ name: 'value', expression: 'Scheduler.class' }],
    },
  ];
  const schedule: ScheduleBinding = {
    kind: 'schedule_binding',
    id: 'schedule-binding',
    source: 'caller',
    owner_source: 'class',
    owner_type: 'fixture.Worker',
    annotations: [
      {
        source: 'scheduled-annotation',
        owner_source: 'caller',
        annotation_type: 'org.springframework.scheduling.annotation.Scheduled',
        arguments: [],
      },
      {
        source: 'lock-annotation',
        owner_source: 'caller',
        annotation_type: 'net.javacrumbs.shedlock.spring.annotation.SchedulerLock',
        arguments: [],
      },
    ],
    conditions: [
      {
        source: 'class-condition',
        owner_source: 'class',
        annotation_type: 'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty',
        arguments: [],
      },
    ],
    activation_declarations: [
      {
        source: 'activation',
        owner_source: 'enable-class',
        annotation_type: 'org.springframework.scheduling.annotation.EnableScheduling',
        arguments: [],
      },
    ],
    lock_provider_sources: ['executor'],
    async_invocations: fixture.async.invocations.map((invocation) => ({
      ...invocation,
      async_binding_id: fixture.async.id,
    })),
    call_binding_ids: ['invoke'],
    value_binding_ids: [],
    support: [],
    activation: 'declared_runtime_unverified',
    lock_scope: 'scheduled_invocation_only_async_completion_unverified',
    completeness: 'partial',
    gaps: ['Effective scheduling and async completion remain unobserved.'],
  };
  const factory: JavaCallBinding = {
    ...fixture.call,
    id: 'factory-call',
    call: 'factory',
    caller: 'caller',
    receiver: null,
    receiverType: 'java.util.List',
    methodName: 'of',
    argumentTypes: ['java.lang.String', 'java.lang.String'],
    target: null,
    signature: null,
    resolution: 'unresolved',
  };
  const constant: JavaConstantBinding = {
    kind: 'java_constant_binding',
    id: 'constant-binding',
    source: 'constant',
    value_source: 'constant-value',
    owner_type: 'fixture.Worker',
    name: 'ACTIVE',
    type: 'java.lang.String',
    value: 'active',
  };
  const reference: JavaValueBinding = {
    kind: 'java_value_binding',
    id: 'constant-reference',
    relation: 'reference',
    from: 'constant',
    to: 'constant-element',
    call: null,
    guards: [],
  };
  const collection: JavaCollectionBinding = {
    kind: 'java_collection_binding',
    id: 'collection-binding',
    source: 'collection',
    owner_source: 'class',
    owner_type: 'fixture.Worker',
    name: 'STATUSES',
    declared_type: 'java.util.List<java.lang.String>',
    factory: 'java.util.List.of',
    factory_call_binding_id: 'factory-call',
    value_source: 'factory',
    elements: [
      { position: 0, source: 'constant-element', constant_source: 'constant', value: 'active' },
      { position: 1, source: 'literal-element', constant_source: null, value: 'pending' },
    ],
    completeness: 'partial',
    gaps: ['Declared source values do not establish runtime configuration.'],
  };
  document.bindings?.push(schedule, factory, constant, reference, collection);
  return { ...fixture, schedule, factory, constant, reference, collection };
}
