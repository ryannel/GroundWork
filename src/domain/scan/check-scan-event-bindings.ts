import { referencesFor } from './check-scan-answers';
import { scanReference, type ScanRecords } from './scan-records';
import type { AsyncBinding, BindingRecord, EventBinding, ExecutionBinding } from './scan.generated';

type EventRecord = AsyncBinding | EventBinding | ExecutionBinding;
type Inside = (inner: string, outer: string | null) => readonly string[];

export function isEventBinding(record: BindingRecord): record is EventRecord {
  return (
    record.kind === 'async_binding' ||
    record.kind === 'execution_binding' ||
    record.kind === 'event_binding'
  );
}

export function eventBindingSources(record: EventRecord): readonly string[] {
  const common = [record.source, record.owner_source, ...record.support];
  if (record.kind === 'async_binding') {
    return [
      ...common,
      record.annotation_source,
      ...record.activation_sources,
      ...record.conditions.flatMap((condition) => [condition.source, condition.owner_source]),
      ...record.executor_sources,
      ...record.invocations.flatMap((call) => [
        call.call_source,
        call.owner_source,
        call.use_source,
      ]),
    ].filter((id) => id !== null);
  }
  if (record.kind === 'execution_binding') {
    return [
      ...common,
      ...record.return_sources,
      ...record.throw_sources,
      ...record.catch_sources,
      ...record.finally_sources,
      ...record.transaction_sources,
      ...record.call_results.flatMap((call) => [call.call_source, call.use_source]),
    ];
  }
  return [...common, ...eventDetailsSources(record)];
}

function eventDetailsSources(record: EventBinding): readonly string[] {
  return [
    record.client.receiver_source,
    ...record.arguments.map((argument) => argument.source),
    ...record.constructions.flatMap((construction) => [
      construction.source,
      ...construction.argument_sources,
      ...construction.fields.flatMap((field) => [field.field_source, field.value_source]),
    ]),
    ...record.builder_calls.flatMap((call) => [
      call.source,
      call.receiver_source,
      ...call.argument_sources,
    ]),
    ...record.selectors.flatMap((selector) => [selector.source, selector.target_source]),
    ...record.candidate_helpers.flatMap((candidate) => [
      candidate.call_source,
      candidate.target_source,
      ...candidate.argument_sources,
      ...candidate.parameter_sources,
    ]),
    ...record.conditions.flatMap((condition) => [
      condition.source,
      condition.condition_source,
      condition.consequent_source,
      condition.alternative_source,
      ...condition.return_sources,
    ]),
    ...record.comparisons.flatMap((comparison) => [
      comparison.source,
      ...comparison.operand_sources,
    ]),
    ...record.failure_paths.flatMap((failure) => [failure.source, failure.thrown_source]),
  ].filter((id) => id !== null);
}

function observedCallErrors(
  record: AsyncBinding | ExecutionBinding,
  records: ScanRecords,
): readonly string[] {
  const calls = record.kind === 'async_binding' ? record.invocations : record.call_results;
  return calls.flatMap((observation) => {
    const call = scanReference(records, observation.call_binding_id, 'java_call_binding');
    const references = referencesFor(records)(
      [observation.call_binding_id],
      ['java_call_binding'],
      record.id,
    );
    if (!record.call_binding_ids.includes(observation.call_binding_id)) {
      references.push(`${record.id}: observed call must be listed in call_binding_ids`);
    }
    if (!call) return references;
    if (call.call !== observation.call_source) {
      references.push(`${record.id}: observed call source must match its Java call binding`);
    }
    const expected = record.kind === 'async_binding' ? call.target : call.caller;
    if (expected !== record.source) {
      references.push(`${record.id}: observed call must match the declared method`);
    }
    return references;
  });
}

function asyncOwnership(record: AsyncBinding, inside: Inside): readonly string[] {
  return [
    ...inside(record.source, record.owner_source),
    ...inside(record.annotation_source, record.owner_source),
    ...(record.conditions.every((condition) =>
      [record.source, record.owner_source].includes(condition.owner_source),
    )
      ? []
      : [`${record.id}: async conditions must belong to its method or class`]),
    ...record.conditions.flatMap((condition) => inside(condition.source, condition.owner_source)),
    ...record.invocations.flatMap((call) => [
      ...inside(call.call_source, call.use_source),
      ...(call.owner_source === null ? [] : inside(call.use_source, call.owner_source)),
    ]),
  ];
}

function executionOwnership(record: ExecutionBinding, inside: Inside): readonly string[] {
  const local = [
    ...record.return_sources,
    ...record.throw_sources,
    ...record.catch_sources,
    ...record.finally_sources,
    ...record.call_results.flatMap((call) => [call.call_source, call.use_source]),
  ];
  return [
    ...inside(record.source, record.owner_source),
    ...local.flatMap((source) => inside(source, record.source)),
    ...record.transaction_sources.flatMap((source) => inside(source, record.owner_source)),
    ...record.call_results.flatMap((call) => inside(call.call_source, call.use_source)),
  ];
}

function constructionErrors(record: EventBinding, inside: Inside): readonly string[] {
  return record.constructions.flatMap((construction) => [
    ...construction.argument_sources.flatMap((source) => inside(source, construction.source)),
    ...construction.fields.flatMap((field) => [
      ...inside(field.value_source, construction.source),
      ...(construction.argument_sources.includes(field.value_source)
        ? []
        : [`${record.id}: constructed field value must match a constructor argument`]),
    ]),
  ]);
}

function eventOwnership(record: EventBinding, inside: Inside): readonly string[] {
  const positions = record.arguments.map((argument) => argument.position).toSorted((a, b) => a - b);
  return [
    ...inside(record.source, record.owner_source),
    ...inside(record.client.receiver_source, record.source),
    ...record.arguments.flatMap((argument) => inside(argument.source, record.source)),
    ...(positions.every((position, index) => position === index)
      ? []
      : [`${record.id}: event argument positions must be contiguous and unique`]),
    ...constructionErrors(record, inside),
    ...record.builder_calls.flatMap((call) => [
      ...inside(call.receiver_source, call.source),
      ...call.argument_sources.flatMap((source) => inside(source, call.source)),
    ]),
    ...record.conditions.flatMap((condition) =>
      [
        condition.condition_source,
        condition.consequent_source,
        condition.alternative_source,
        ...condition.return_sources,
      ]
        .filter((source) => source !== null)
        .flatMap((source) => inside(source, condition.source)),
    ),
    ...record.comparisons.flatMap((comparison) =>
      comparison.operand_sources.flatMap((source) => inside(source, comparison.source)),
    ),
    ...record.failure_paths.flatMap((failure) => [
      ...inside(failure.source, record.owner_source),
      ...(failure.thrown_source === null ? [] : inside(failure.thrown_source, failure.source)),
    ]),
  ];
}

function selectorErrors(record: EventBinding, records: ScanRecords): readonly string[] {
  return record.selectors.flatMap((selector) => {
    const candidates = record.call_binding_ids
      .map((id) => scanReference(records, id, 'java_call_binding'))
      .filter((call) => call?.call === selector.source);
    const call = candidates[0];
    const matches =
      candidates.length === 1 &&
      call?.receiverType === selector.receiver_type &&
      call.methodName === selector.operation &&
      call.target === selector.target_source;
    return matches ? [] : [`${record.id}: event selector must match one indexed Java call`];
  });
}

function candidateErrors(
  record: EventBinding,
  context: { readonly records: ScanRecords; readonly inside: Inside },
): readonly string[] {
  return record.candidate_helpers.flatMap((candidate) => {
    const call = record.call_binding_ids
      .map((id) => scanReference(context.records, id, 'java_call_binding'))
      .find((indexed) => indexed?.call === candidate.call_source);
    const source = scanReference(context.records, candidate.call_source, 'source');
    const target = scanReference(context.records, candidate.target_source, 'source');
    const matches =
      call?.resolution === 'unresolved' &&
      source?.path === target?.path &&
      candidate.argument_sources.length === candidate.parameter_sources.length;
    return [
      ...(matches
        ? []
        : [`${record.id}: source candidate needs an unresolved same-file call and matched arity`]),
      ...candidate.argument_sources.flatMap((id) => context.inside(id, candidate.call_source)),
      ...candidate.parameter_sources.flatMap((id) => context.inside(id, candidate.target_source)),
    ];
  });
}

/** Source metadata cannot claim an acknowledgement or effective asynchronous activation. */
export function eventBindingErrors(
  record: EventRecord,
  context: { readonly records: ScanRecords; readonly inside: Inside },
): readonly string[] {
  if (record.kind === 'event_binding') {
    return [
      ...eventOwnership(record, context.inside),
      ...selectorErrors(record, context.records),
      ...candidateErrors(record, context),
    ];
  }
  return [
    ...observedCallErrors(record, context.records),
    ...(record.kind === 'async_binding'
      ? asyncOwnership(record, context.inside)
      : executionOwnership(record, context.inside)),
  ];
}
