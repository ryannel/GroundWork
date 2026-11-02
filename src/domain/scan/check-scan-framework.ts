import { referencesFor } from './check-scan-answers';
import { scanReference, type ScanRecords } from './scan-records';
import type { AspNetRouteBinding, FrameworkRecord, ScanDocument, Source } from './scan.generated';

function sources(record: FrameworkRecord): readonly string[] {
  if (record.kind === 'source_framework_binding') {
    return [
      record.source,
      ...record.support,
      ...(record.target_source === null ? [] : [record.target_source]),
    ];
  }
  if (record.kind === 'aspnet_route_binding') {
    return [
      record.source,
      ...record.support,
      ...record.parameters.map((parameter) => parameter.source),
    ];
  }
  if (record.kind === 'schema_binding') {
    return [
      record.source,
      ...record.support,
      ...record.properties.flatMap((property) => [
        property.source,
        ...property.annotations.map((annotation) => annotation.source),
      ]),
    ];
  }
  if (record.kind === 'route_binding') {
    return [
      ...record.source_ids,
      record.method.declaration_source_id,
      ...record.parameters.map((parameter) => parameter.source_id),
      ...(record.method.implementation_source_id === undefined
        ? []
        : [record.method.implementation_source_id]),
    ];
  }
  return [
    ...record.source_ids,
    ...record.policies.map((policy) => policy.source_id),
    ...record.activation.source_ids,
    ...record.enforcement_chain.flatMap((stage) => stage.source_ids),
  ];
}
function origin(record: FrameworkRecord, records: ScanRecords): Source | undefined {
  const id =
    record.kind === 'schema_binding' ||
    record.kind === 'source_framework_binding' ||
    record.kind === 'aspnet_route_binding'
      ? record.source
      : record.source_ids[0];
  return id === undefined ? undefined : scanReference(records, id, 'source');
}
function pinErrors(record: FrameworkRecord, records: ScanRecords): readonly string[] {
  const primary = origin(record, records);
  if (!primary) return [`${record.id}: framework record needs a primary source`];
  return sources(record).flatMap((id) => {
    const source = scanReference(records, id, 'source');
    if (!source || (source.repo === primary.repo && source.commit === primary.commit)) return [];
    return [`${record.id}: framework source ${id} crosses repository or commit`];
  });
}
function linkedPinErrors(
  record: FrameworkRecord,
  target: FrameworkRecord | undefined,
  records: ScanRecords,
): readonly string[] {
  if (!target) return [];
  const left = origin(record, records);
  const right = origin(target, records);
  if (!left || !right) return [];
  const samePin = left.repo === right.repo && left.commit === right.commit;
  return samePin
    ? []
    : [`${record.id}: framework reference ${target.id} crosses repository or commit`];
}
function bindingErrors(record: FrameworkRecord, records: ScanRecords): readonly string[] {
  if (record.kind === 'aspnet_route_binding') {
    return [
      ...referencesFor(records)(
        [...record.input_contract_ids, ...record.output_contract_ids],
        ['contract'],
        record.id,
      ),
      ...aspnetContractPins(record, records),
    ];
  }
  if (record.kind === 'security_binding' || record.kind === 'source_framework_binding') {
    return [];
  }
  if (record.kind === 'route_binding') {
    return [
      ...record.security_binding_ids.flatMap((id) => [
        ...referencesFor(records)([id], ['security_binding'], record.id),
        ...linkedPinErrors(record, scanReference(records, id, 'security_binding'), records),
      ]),
      ...(record.schema_binding_ids ?? []).flatMap((id) => [
        ...referencesFor(records)([id], ['schema_binding'], record.id),
        ...linkedPinErrors(record, scanReference(records, id, 'schema_binding'), records),
      ]),
    ];
  }

  return record.profiles.flatMap((profile) => [
    ...referencesFor(records)([profile.routeId], ['route_binding'], record.id),
    ...linkedPinErrors(record, scanReference(records, profile.routeId, 'route_binding'), records),
  ]);
}

/** Framework declarations are useful only with resolvable, consistently pinned evidence. */
export function frameworkErrors(document: ScanDocument, records: ScanRecords): readonly string[] {
  return (document.framework ?? []).flatMap((record) => [
    ...referencesFor(records)(sources(record), ['source'], record.id),
    ...pinErrors(record, records),
    ...bindingErrors(record, records),
  ]);
}

function aspnetContractPins(record: AspNetRouteBinding, records: ScanRecords): readonly string[] {
  const primary = origin(record, records);
  if (primary === undefined) return [];
  return [...record.input_contract_ids, ...record.output_contract_ids].flatMap((id) => {
    const contract = scanReference(records, id, 'contract');
    return (contract?.support ?? []).flatMap((support) => {
      const source = scanReference(records, support, 'source');
      return source !== undefined &&
        (source.repo !== primary.repo || source.commit !== primary.commit)
        ? [`${record.id}: contract ${id} crosses repository or commit`]
        : [];
    });
  });
}
