import type {
  AsyncBinding,
  EventBinding,
  ExecutionBinding,
  JavaCallBinding,
} from '@/domain/scan/scan.generated';

import { scanFixture } from './scan-kit';

/** Synthetic spans keep every ownership mutation independent of application source. */
export function eventBindingFixture() {
  const document = scanFixture();
  const template = document.sources[0]!;
  const spans = [
    ['class', 'Worker.java', 1, 100],
    ['async', 'Worker.java', 10, 40],
    ['annotation', 'Worker.java', 9, 9],
    ['activation', 'Config.java', 1, 2],
    ['executor', 'Config.java', 3, 20],
    ['caller', 'Worker.java', 50, 90],
    ['call', 'Worker.java', 55, 55],
    ['use', 'Worker.java', 55, 56],
    ['receiver', 'Worker.java', 55, 55],
    ['event-call', 'Worker.java', 20, 20],
    ['event-receiver', 'Worker.java', 20, 20],
    ['event-arg', 'Worker.java', 20, 20],
    ['constructor', 'Worker.java', 15, 16],
    ['constructor-arg', 'Worker.java', 16, 16],
    ['field', 'Event.java', 3, 3],
    ['condition', 'Worker.java', 11, 13],
    ['predicate', 'Worker.java', 11, 11],
    ['consequent', 'Worker.java', 12, 13],
    ['early-return', 'Worker.java', 12, 12],
    ['return', 'Worker.java', 30, 30],
    ['throw', 'Worker.java', 31, 31],
    ['catch', 'Worker.java', 32, 33],
    ['finally', 'Worker.java', 34, 35],
    ['transaction', 'Worker.java', 8, 8],
    ['builder', 'Worker.java', 18, 18],
    ['builder-arg', 'Worker.java', 18, 18],
    ['selector', 'Worker.java', 17, 17],
    ['selector-target', 'Selector.java', 1, 5],
  ] as const;
  document.sources.push(
    ...spans.map(([id, path, from, to]) => ({
      ...template,
      id,
      path,
      lines: [from, to] as [number, number],
    })),
  );
  const call: JavaCallBinding = {
    kind: 'java_call_binding',
    id: 'invoke',
    call: 'call',
    caller: 'caller',
    receiver: 'receiver',
    receiverType: 'fixture.Worker',
    methodName: 'work',
    argumentTypes: [],
    target: 'async',
    signature: 'fixture.Worker#work():void',
    resolution: 'exact',
    reason: 'Synthetic exact declaration.',
    guards: [],
  };
  const send: JavaCallBinding = {
    ...call,
    id: 'send',
    call: 'event-call',
    caller: 'async',
    receiver: 'event-receiver',
    receiverType: 'org.springframework.kafka.core.KafkaTemplate',
    methodName: 'send',
    argumentTypes: ['Message'],
    target: null,
    signature: null,
    resolution: 'unresolved',
  };
  const selector: JavaCallBinding = {
    ...call,
    id: 'selector-call',
    call: 'selector',
    caller: 'async',
    receiver: null,
    receiverType: 'fixture.Selector',
    methodName: 'select',
    target: 'selector-target',
    signature: 'fixture.Selector#select():String',
  };
  const common = {
    call_binding_ids: [] as string[],
    value_binding_ids: [] as string[],
    support: [] as string[],
    completeness: 'partial' as const,
    gaps: ['Runtime unobserved.'],
  };
  const async: AsyncBinding = {
    ...common,
    kind: 'async_binding',
    conditions: [],
    id: 'async-binding',
    source: 'async',
    owner_source: 'class',
    owner_type: 'fixture.Worker',
    annotation_source: 'annotation',
    executor: null,
    activation_sources: ['activation'],
    executor_sources: ['executor'],
    activation: 'declared_runtime_unverified',
    return_type: 'void',
    completion: 'void',
    call_binding_ids: ['invoke'],
    invocations: [
      {
        call_source: 'call',
        owner_source: 'caller',
        call_binding_id: 'invoke',
        dispatch: 'receiver_proxy_unverified',
        use: 'ignored',
        use_source: 'use',
      },
    ],
  };
  const execution: ExecutionBinding = {
    ...common,
    kind: 'execution_binding',
    id: 'execution-binding',
    source: 'async',
    owner_source: 'class',
    owner_type: 'fixture.Worker',
    call_binding_ids: ['send', 'selector-call'],
    call_results: [
      {
        call_source: 'event-call',
        call_binding_id: 'send',
        use: 'ignored',
        use_source: 'event-call',
      },
    ],
    return_sources: ['return'],
    throw_sources: ['throw'],
    catch_sources: ['catch'],
    finally_sources: ['finally'],
    transaction_sources: ['transaction'],
    transaction: 'declared_runtime_unverified',
    failure: 'source_paths_only',
    completion: 'source_returns_only',
  };
  const event: EventBinding = {
    ...common,
    kind: 'event_binding',
    candidate_helpers: [],
    id: 'event-binding',
    source: 'event-call',
    owner_source: 'async',
    client: {
      type: 'org.springframework.kafka.core.KafkaTemplate',
      receiver_source: 'event-receiver',
    },
    operation: 'send',
    contract: 'spring_kafka',
    arguments: [{ position: 0, role: 'message', source: 'event-arg', type: 'Message' }],
    constructions: [
      {
        source: 'constructor',
        type: 'fixture.Event',
        argument_sources: ['constructor-arg'],
        fields: [{ field: 'name', field_source: 'field', value_source: 'constructor-arg' }],
      },
    ],
    builder_calls: [
      {
        source: 'builder',
        operation: 'build',
        receiver_source: 'builder',
        argument_sources: ['builder-arg'],
      },
    ],
    selectors: [
      {
        source: 'selector',
        receiver_type: 'fixture.Selector',
        operation: 'select',
        target_source: 'selector-target',
      },
    ],
    conditions: [
      {
        source: 'condition',
        condition_source: 'predicate',
        consequent_source: 'consequent',
        alternative_source: null,
        return_sources: ['early-return'],
      },
    ],
    comparisons: [{ source: 'predicate', operator: '==', operand_sources: ['predicate'] }],
    result_observation: 'discarded',
    failure_paths: [],
    call_binding_ids: ['send', 'selector-call'],
  };
  document.bindings = [call, send, selector, async, execution, event];
  return { document, async, execution, event, call, send, selector };
}
