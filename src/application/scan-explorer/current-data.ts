import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';

import { currentSourceIds } from './current-source-ids';

/** Follow explicit storage/schema references; source DTO fields do not acquire wire authority. */
export function currentDataRecords(
  records: readonly CurrentRecord[],
  requested: readonly string[],
): readonly CurrentRecord[] {
  const wanted = new Set(requested);
  const selected = records.filter(
    (record) => wanted.has(record.id) || currentSourceIds(record).some((id) => wanted.has(id)),
  );
  const types = new Set(
    selected.flatMap((record) => ('entityType' in record ? [record.entityType] : [])),
  );
  const references = new Set(selected.flatMap(storageReferences));
  return [
    ...new Map(
      [
        ...selected,
        ...records.filter(
          (record) =>
            references.has(record.id) ||
            (record.kind === 'schema_binding' && types.has(record.typeName)),
        ),
      ].map((record) => [record.id, record]),
    ).values(),
  ];
}

function storageReferences(record: CurrentRecord): readonly string[] {
  if (record.kind === 'mongo_operation_binding') {
    return [record.collection_id, record.repository_id].filter((reference) => reference !== null);
  }
  if (record.kind === 'mongo_repository_binding') return [record.collection_id];
  return [];
}
