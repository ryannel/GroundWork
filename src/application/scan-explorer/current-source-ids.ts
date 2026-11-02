import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';

function directSources(record: CurrentRecord): readonly string[] {
  const source = 'source' in record ? [record.source] : [];
  const support = 'support' in record ? record.support : [];
  const declared = 'source_ids' in record ? record.source_ids : [];
  return [...source, ...support, ...declared];
}

function detailSources(record: CurrentRecord): readonly string[] {
  if (record.kind === 'csharp_symbol_binding') return record.configurationSources;
  if (record.kind === 'async_binding') {
    return [
      record.annotation_source,
      ...record.invocations.map((invocation) => invocation.call_source),
    ];
  }
  if (record.kind === 'schema_binding') {
    return record.properties.flatMap((property) => [
      property.source,
      ...property.annotations.map((annotation) => annotation.source),
    ]);
  }
  if (record.kind === 'java_value_binding') {
    return [record.from, record.to, ...(record.call === null ? [] : [record.call])];
  }
  if (record.kind === 'mongo_operation_binding') return [record.receiver_source];
  if ('call' in record && typeof record.call === 'string') return [record.call];
  return [];
}

export function currentSourceIds(record: CurrentRecord): readonly string[] {
  if (record.kind === 'source') return [record.id];
  return [...new Set([...directSources(record), ...detailSources(record)])];
}
