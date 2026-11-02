import type {
  BindingRecord,
  GraphqlBinding,
  GraphqlDocumentBinding,
  JavaConstantBinding,
  LibraryBinding,
} from './scan.generated';

type ClientRecord = GraphqlBinding | GraphqlDocumentBinding | JavaConstantBinding | LibraryBinding;

export function isClientBinding(record: BindingRecord): record is ClientRecord {
  return (
    record.kind === 'graphql_binding' ||
    record.kind === 'library_binding' ||
    record.kind === 'graphql_document_binding' ||
    record.kind === 'java_constant_binding'
  );
}

export function clientBindingSources(record: ClientRecord): readonly string[] {
  if (record.kind === 'java_constant_binding') return [record.source, record.value_source];
  if (record.kind === 'graphql_document_binding') {
    return [
      record.source,
      ...record.variables.map((variable) => variable.source),
      ...record.selections.flatMap((field) => [
        field.source,
        ...field.arguments.map((argument) => argument.source),
      ]),
    ];
  }
  const common = [
    record.source,
    record.owner_source,
    ...record.support,
    ...record.failure_paths.flatMap((failure) => [failure.source, failure.thrown_source]),
  ];
  if (record.kind === 'library_binding') {
    return [
      ...common,
      record.call_source,
      record.receiver_source,
      ...record.argument_sources,
    ].filter((id) => id !== null);
  }
  return [
    ...common,
    record.client.receiver_source,
    record.client.registry_source,
    record.document_source,
    record.execution_source,
    ...record.variables.flatMap((variable) => [variable.source, ...variable.value_sources]),
    record.response.field_source,
    record.response.type_source,
    record.response.body_source,
    ...record.response.return_sources,
  ].filter((id) => id !== null);
}

function localClientSources(record: GraphqlBinding | LibraryBinding): readonly string[] {
  const local = [record.source, ...record.failure_paths.map((failure) => failure.source)];
  if (record.kind === 'library_binding') {
    local.push(record.call_source, ...record.argument_sources);
    if (record.receiver_source !== null) local.push(record.receiver_source);
  } else {
    local.push(
      record.document_source,
      record.execution_source,
      record.response.body_source,
      ...record.response.return_sources,
      ...record.variables.flatMap((variable) => [variable.source, ...variable.value_sources]),
    );
    if (record.response.field_source !== null) local.push(record.response.field_source);
    if (record.response.type_source !== null) local.push(record.response.type_source);
  }
  return local;
}

export function clientBindingOwnership(
  record: ClientRecord,
  inside: (inner: string, outer: string | null) => readonly string[],
): readonly string[] {
  if (record.kind === 'java_constant_binding') return inside(record.value_source, record.source);
  if (record.kind === 'graphql_document_binding') {
    return clientBindingSources(record).flatMap((source) => inside(source, record.source));
  }
  const local = localClientSources(record);
  return [
    ...local.flatMap((source) => inside(source, record.owner_source)),
    ...(record.kind === 'library_binding'
      ? [
          ...record.argument_sources.flatMap((source) => inside(source, record.call_source)),
          ...(record.receiver_source === null
            ? []
            : inside(record.receiver_source, record.call_source)),
        ]
      : [
          ...inside(record.client.receiver_source, record.document_source),
          ...record.variables.flatMap((variable) =>
            variable.value_sources.flatMap((source) => inside(source, variable.source)),
          ),
        ]),
    ...record.failure_paths.flatMap((failure) =>
      failure.thrown_source === null ? [] : inside(failure.thrown_source, failure.source),
    ),
  ];
}
