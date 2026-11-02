import { referencesFor } from './check-scan-answers';
import { scanReference, type ScanRecords } from './scan-records';
import type { BindingRecord, JavaCollectionBinding, ScheduleBinding } from './scan.generated';

type ArchiveBinding = JavaCollectionBinding | ScheduleBinding;
type Inside = (inner: string, outer: string | null) => readonly string[];
interface Context {
  readonly records: ScanRecords;
  readonly inside: Inside;
}

export function isArchiveBinding(record: BindingRecord): record is ArchiveBinding {
  return record.kind === 'java_collection_binding' || record.kind === 'schedule_binding';
}

export function archiveBindingSources(record: ArchiveBinding): readonly string[] {
  if (record.kind === 'java_collection_binding') {
    return [
      record.source,
      record.owner_source,
      record.value_source,
      ...record.elements.flatMap((element) => [element.source, element.constant_source]),
    ].filter((source) => source !== null);
  }
  return [
    record.source,
    record.owner_source,
    ...record.support,
    ...record.annotations.flatMap((annotation) => [annotation.source, annotation.owner_source]),
    ...record.conditions.flatMap((condition) => [condition.source, condition.owner_source]),
    ...record.activation_declarations.flatMap((annotation) => [
      annotation.source,
      annotation.owner_source,
    ]),
    ...record.lock_provider_sources,
    ...record.async_invocations.flatMap((invocation) => [
      invocation.call_source,
      invocation.owner_source,
      invocation.use_source,
    ]),
  ].filter((source) => source !== null);
}

function collectionErrors(record: JavaCollectionBinding, context: Context): readonly string[] {
  const call = scanReference(context.records, record.factory_call_binding_id, 'java_call_binding');
  const errors = [
    ...referencesFor(context.records)(
      [record.factory_call_binding_id],
      ['java_call_binding'],
      record.id,
    ),
    ...context.inside(record.source, record.owner_source),
    ...context.inside(record.value_source, record.source),
  ];
  const factory =
    call?.call === record.value_source &&
    call.receiverType === 'java.util.List' &&
    call.methodName === 'of';
  if (!factory || call.argumentTypes.length !== record.elements.length) {
    errors.push(`${record.id}: collection factory must match its indexed call and element arity`);
  }
  errors.push(
    ...record.elements.flatMap((element, position) =>
      elementErrors({ record, element, position }, context),
    ),
  );
  return errors;
}

function elementErrors(
  input: {
    readonly record: JavaCollectionBinding;
    readonly element: JavaCollectionBinding['elements'][number];
    readonly position: number;
  },
  context: Context,
): readonly string[] {
  const { record, element, position } = input;
  const errors = [...context.inside(element.source, record.value_source)];
  if (element.position !== position) {
    errors.push(`${record.id}: collection element positions must be contiguous and ordered`);
  }
  if (element.constant_source === null) return errors;
  const values = [...context.records.values()];
  const constant = values
    .filter((entry) => entry.kind === 'java_constant_binding')
    .find((entry) => entry.source === element.constant_source);
  const matches = constant?.type === 'java.lang.String' && constant.value === element.value;
  const linked = values.some(
    (entry) =>
      entry.kind === 'java_value_binding' &&
      entry.relation === 'reference' &&
      entry.from === element.constant_source &&
      entry.to === element.source,
  );
  if (!matches || !linked) {
    errors.push(
      `${record.id}: collection constant must match its declared string value and lexical reference`,
    );
  }
  return errors;
}

function scheduleDeclarations(record: ScheduleBinding, inside: Inside): readonly string[] {
  const errors = [
    ...inside(record.source, record.owner_source),
    ...record.annotations.flatMap((entry) => inside(entry.source, record.source)),
    ...record.conditions.flatMap((entry) => inside(entry.source, entry.owner_source)),
    ...record.activation_declarations.flatMap((entry) => inside(entry.source, entry.owner_source)),
  ];
  if (
    record.conditions.some(
      (entry) => ![record.source, record.owner_source].includes(entry.owner_source),
    )
  ) {
    errors.push(`${record.id}: schedule conditions must belong to its method or class`);
  }
  const methodKinds = [
    'org.springframework.scheduling.annotation.Scheduled',
    'net.javacrumbs.shedlock.spring.annotation.SchedulerLock',
  ];
  if (!record.annotations.some((entry) => entry.annotation_type === methodKinds[0])) {
    errors.push(`${record.id}: schedule binding requires a Scheduled declaration`);
  }
  if (
    record.annotations.some(
      (entry) =>
        !methodKinds.includes(entry.annotation_type) || entry.owner_source !== record.source,
    )
  ) {
    errors.push(`${record.id}: schedule annotations must belong to the scheduled method`);
  }
  if (record.activation_declarations.some((entry) => methodKinds.includes(entry.annotation_type))) {
    errors.push(`${record.id}: scheduling activation requires an enablement annotation`);
  }
  return errors;
}

function asyncLinks(record: ScheduleBinding, context: Context): readonly string[] {
  return record.async_invocations.flatMap((invocation) => {
    const errors = referencesFor(context.records)(
      [invocation.async_binding_id],
      ['async_binding'],
      record.id,
    );
    const target = scanReference(context.records, invocation.async_binding_id, 'async_binding');
    const call = scanReference(context.records, invocation.call_binding_id, 'java_call_binding');
    const observation = target?.invocations.find(
      (entry) =>
        entry.call_source === invocation.call_source &&
        entry.call_binding_id === invocation.call_binding_id &&
        entry.owner_source === invocation.owner_source,
    );
    const local = invocation.owner_source === record.source && call?.caller === record.source;
    const signature = call?.target === target?.source && call?.call === invocation.call_source;
    const use = [
      observation?.dispatch === invocation.dispatch,
      observation?.use === invocation.use,
      observation?.use_source === invocation.use_source,
    ].every(Boolean);
    if (
      ![local, signature, use, record.call_binding_ids.includes(invocation.call_binding_id)].every(
        Boolean,
      )
    ) {
      errors.push(
        `${record.id}: scheduled async invocation must match its declared caller, target and observation`,
      );
    }
    errors.push(...context.inside(invocation.call_source, record.source));
    return errors;
  });
}

export function archiveBindingErrors(record: ArchiveBinding, context: Context): readonly string[] {
  return record.kind === 'java_collection_binding'
    ? collectionErrors(record, context)
    : [...scheduleDeclarations(record, context.inside), ...asyncLinks(record, context)];
}
