import { referencesFor } from './check-scan-answers';
import { scanReference, type ScanRecords } from './scan-records';
import type {
  BindingRecord,
  ConfigurationBinding,
  ConsumerBinding,
  EnumBinding,
} from './scan.generated';

type MessageBinding = ConfigurationBinding | ConsumerBinding | EnumBinding;
type Inside = (inner: string, outer: string | null) => readonly string[];

export function isMessageBinding(record: BindingRecord): record is MessageBinding {
  return (
    record.kind === 'configuration_binding' ||
    record.kind === 'consumer_binding' ||
    record.kind === 'enum_binding'
  );
}

export function messageBindingSources(record: MessageBinding): readonly string[] {
  if (record.kind === 'configuration_binding') {
    return [
      record.source,
      ...record.properties.map((property) => property.source),
      ...record.conditions.flatMap((condition) => [condition.source, condition.owner_source]),
      ...record.selectors.flatMap((selector) => [selector.source, selector.property_source]),
      ...record.factories.flatMap((factory) => [factory.source, ...factory.parameter_sources]),
    ];
  }
  if (record.kind === 'enum_binding') {
    return [
      record.source,
      ...record.value_method_sources,
      ...record.constants.flatMap((constant) => [
        constant.source,
        constant.json_name_source,
        ...constant.annotation_sources,
        ...constant.argument_sources,
      ]),
    ].filter((id) => id !== null);
  }
  return [
    record.source,
    record.owner_source,
    record.annotation_source,
    ...record.support,
    ...record.selectors.map((selector) => selector.source),
    ...record.parameters.flatMap((parameter) => [
      parameter.source,
      parameter.payload_annotation_source,
    ]),
    ...record.conditions.flatMap((condition) => [condition.source, condition.owner_source]),
    ...record.factory_candidates.flatMap((factory) => [factory.source, factory.annotation_source]),
    ...record.deserialisations.flatMap((entry) => [
      entry.source,
      entry.owner_source,
      ...entry.argument_sources,
      ...entry.type_reference_sources,
    ]),
    ...record.model_declarations.flatMap((model) => [model.source, ...model.field_sources]),
    ...record.calls.flatMap((call) => [
      call.source,
      call.owner_source,
      call.target_source,
      ...call.argument_sources,
    ]),
    ...record.candidate_helpers.flatMap((candidate) => [
      candidate.call_source,
      candidate.target_source,
      ...candidate.argument_sources,
      ...candidate.parameter_sources,
    ]),
    ...record.return_sources,
    ...record.throw_sources,
    ...record.catch_sources,
  ].filter((id) => id !== null);
}

function configurationErrors(
  record: ConfigurationBinding,
  context: { readonly records: ScanRecords; readonly inside: Inside },
): readonly string[] {
  const errors = record.properties.flatMap((property) =>
    context.inside(property.source, record.source),
  );
  const java = record.format === 'java_properties';
  if (java !== (record.declared_type !== null && record.prefix !== null)) {
    errors.push(`${record.id}: configuration format must agree with Java declaration identity`);
  }
  if (!java && (record.declared_type !== null || record.prefix !== null)) {
    errors.push(`${record.id}: resource declarations cannot contain Java identity`);
  }
  if (!java && (record.selectors.length > 0 || record.factories.length > 0)) {
    errors.push(`${record.id}: resource declarations cannot contain Java selectors or factories`);
  }
  return [
    ...errors,
    ...record.conditions.flatMap((condition) =>
      context.inside(condition.source, condition.owner_source),
    ),
    ...configurationProperties(record),
    ...configurationSelectors(record),
    ...configurationFactories(record, context),
  ];
}

function configurationProperties(record: ConfigurationBinding): readonly string[] {
  const errors: string[] = [];
  const java = record.format === 'java_properties';
  for (const property of record.properties) {
    if (
      java &&
      (property.value_kind !== 'declaration' || property.value !== null || property.type === null)
    ) {
      errors.push(`${record.id}: Java properties need typed declarations without effective values`);
    }
    if (!java && (property.value_kind === 'declaration' || property.type !== null)) {
      errors.push(`${record.id}: resource properties must preserve source value representation`);
    }
  }
  return errors;
}

function configurationSelectors(record: ConfigurationBinding): readonly string[] {
  const errors: string[] = [];
  for (const selector of record.selectors) {
    const property = record.properties.find(
      (entry) => entry.source === selector.property_source && entry.key === selector.property_key,
    );
    if (!property || selector.receiver_type !== record.declared_type) {
      errors.push(`${record.id}: configuration selector must match its declared property`);
    }
  }
  return errors;
}

function configurationFactories(
  record: ConfigurationBinding,
  context: { readonly records: ScanRecords; readonly inside: Inside },
): readonly string[] {
  const errors: string[] = [];
  for (const factory of record.factories) {
    errors.push(
      ...factory.parameter_sources.flatMap((source) => context.inside(source, factory.source)),
    );
    for (const id of factory.call_binding_ids) {
      errors.push(...referencesFor(context.records)([id], ['java_call_binding'], record.id));
      const call = scanReference(context.records, id, 'java_call_binding');
      const primary = scanReference(context.records, record.source, 'source');
      const callSource = scanReference(context.records, call?.call ?? '', 'source');
      if (
        primary &&
        callSource &&
        (primary.repo !== callSource.repo || primary.commit !== callSource.commit)
      ) {
        errors.push(`${record.id}: configuration factory call crosses repository or commit`);
      }
      if (call && call.caller !== factory.source) {
        errors.push(`${record.id}: factory call must belong to its declared method`);
      }
    }
  }
  return errors;
}

function enumErrors(record: EnumBinding, inside: Inside): readonly string[] {
  const names = record.constants.map((constant) => constant.name);
  const errors =
    new Set(names).size === names.length ? [] : [`${record.id}: duplicate enum constant name`];
  for (const constant of record.constants) {
    errors.push(...inside(constant.source, record.source));
    const sources = [...constant.annotation_sources, ...constant.argument_sources];
    if (constant.json_name_source !== null) sources.push(constant.json_name_source);
    errors.push(...sources.flatMap((source) => inside(source, constant.source)));
    if ((constant.declared_json_name === null) !== (constant.json_name_source === null)) {
      errors.push(`${record.id}: declared JSON name requires its literal source`);
    }
    if (constant.declared_json_name !== null && constant.annotation_sources.length !== 1) {
      errors.push(`${record.id}: declared JSON name requires one annotation declaration`);
    }
  }
  return [
    ...errors,
    ...record.value_method_sources.flatMap((source) => inside(source, record.source)),
  ];
}

function consumerCallErrors(record: ConsumerBinding, records: ScanRecords): readonly string[] {
  return record.calls.flatMap((entry) => {
    const errors = referencesFor(records)(
      [entry.call_binding_id],
      ['java_call_binding'],
      record.id,
    );
    const call = scanReference(records, entry.call_binding_id, 'java_call_binding');
    const identity = call?.call === entry.source && call.caller === entry.owner_source;
    const signature =
      call?.methodName === entry.operation &&
      call.receiverType === entry.receiver_type &&
      call.target === entry.target_source;
    if (!identity || !signature || !record.call_binding_ids.includes(entry.call_binding_id)) {
      errors.push(`${record.id}: consumer call must match its indexed Java call`);
    }
    return errors;
  });
}

function candidateErrors(
  record: ConsumerBinding,
  context: { readonly records: ScanRecords; readonly inside: Inside },
): readonly string[] {
  return record.candidate_helpers.flatMap((candidate) => {
    const call = record.calls.find((entry) => entry.source === candidate.call_source);
    const indexed = scanReference(
      context.records,
      call?.call_binding_id ?? '',
      'java_call_binding',
    );
    const unresolved = indexed?.resolution === 'unresolved' && indexed.target === null;
    return [
      ...(unresolved &&
      indexed.argumentTypes.length === candidate.argument_sources.length &&
      candidate.argument_sources.length === candidate.parameter_sources.length
        ? []
        : [`${record.id}: nominal candidate needs an unresolved indexed call and matched arity`]),
      ...candidate.argument_sources.flatMap((source) =>
        context.inside(source, candidate.call_source),
      ),
      ...candidate.parameter_sources.flatMap((source) =>
        context.inside(source, candidate.target_source),
      ),
    ];
  });
}

function consumerOwnership(record: ConsumerBinding, inside: Inside): readonly string[] {
  return [
    ...inside(record.source, record.owner_source),
    ...inside(record.annotation_source, record.owner_source),
    ...record.selectors.flatMap((selector) => inside(selector.source, record.annotation_source)),
    ...record.parameters.flatMap((parameter) => [
      ...inside(parameter.source, record.source),
      ...(parameter.payload_annotation_source === null
        ? []
        : inside(parameter.payload_annotation_source, parameter.source)),
    ]),
    ...record.conditions.flatMap((condition) => inside(condition.source, condition.owner_source)),
    ...record.factory_candidates.flatMap((factory) =>
      inside(factory.annotation_source, factory.source),
    ),
    ...record.deserialisations.flatMap((entry) => [
      ...inside(entry.source, entry.owner_source),
      ...entry.argument_sources.flatMap((source) => inside(source, entry.source)),
    ]),
    ...record.model_declarations.flatMap((model) =>
      model.field_sources.flatMap((source) => inside(source, model.source)),
    ),
    ...record.calls.flatMap((call) => [
      ...(call.owner_source === null ? [] : inside(call.source, call.owner_source)),
      ...call.argument_sources.flatMap((source) => inside(source, call.source)),
    ]),
  ];
}

export function messageBindingErrors(
  record: MessageBinding,
  context: { readonly records: ScanRecords; readonly inside: Inside },
): readonly string[] {
  if (record.kind === 'configuration_binding') return configurationErrors(record, context);
  if (record.kind === 'enum_binding') return enumErrors(record, context.inside);
  return [
    ...consumerOwnership(record, context.inside),
    ...consumerCallErrors(record, context.records),
    ...candidateErrors(record, context),
  ];
}
