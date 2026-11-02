import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';

import type { VisualEntry } from './visual-types';

export function visualEntries(records: readonly CurrentRecord[]): VisualEntry[] {
  return records.flatMap((record): VisualEntry[] => {
    if (record.kind === 'source_framework_binding') return otherEntry(record);
    if (record.kind === 'route_binding') {
      return [
        {
          id: record.id,
          kind: 'http',
          label: `${record.http_method} ${record.path}`,
          source: record.method.implementation_source_id ?? record.method.declaration_source_id,
          sourceIds: record.source_ids,
          schemas: record.schema_binding_ids ?? [],
        },
      ];
    }
    if (record.kind === 'aspnet_route_binding') {
      return [
        {
          id: record.id,
          kind: 'http',
          label: `${record.httpMethods.join('/')} ${record.template ?? 'unresolved route'}`,
          source: record.source,
          sourceIds: record.support,
          schemas: [...record.input_contract_ids, ...record.output_contract_ids],
        },
      ];
    }
    if (record.kind === 'schedule_binding') {
      return [
        {
          id: record.id,
          kind: 'job',
          label: `Job · ${record.owner_type.split('.').at(-1) ?? record.owner_type}`,
          source: record.source,
          sourceIds: [record.source, ...record.annotations.map((annotation) => annotation.source)],
          schemas: [],
        },
      ];
    }
    if (record.kind === 'consumer_binding') {
      return [
        {
          id: record.id,
          kind: 'consumer',
          label: `Consumer · ${record.owner_type.split('.').at(-1) ?? record.owner_type}`,
          source: record.source,
          sourceIds: [record.source],
          schemas: [],
        },
      ];
    }
    return [];
  });
}

function otherEntry(
  record: Extract<CurrentRecord, { readonly kind: 'source_framework_binding' }>,
): VisualEntry[] {
  if (record.role === 'declared_schema') return [];
  return [
    {
      id: record.id,
      kind: record.role === 'http_entry' ? 'http' : 'plugin',
      label: `${record.framework}: ${record.name}`,
      source: record.target_source ?? record.source,
      sourceIds: record.support,
      schemas: [],
    },
  ];
}
