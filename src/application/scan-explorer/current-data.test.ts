import { describe, expect, it } from 'vitest';

import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';

import { currentDataRecords } from './current-data';
import { currentSourceIds } from './current-source-ids';

const records: readonly CurrentRecord[] = [
  {
    kind: 'mongo_operation_binding',
    id: 'read',
    receiverType: 'Repository',
    receiver_source: 'field',
    method: 'findById',
    operation: 'read',
    collection_id: 'collection',
    repository_id: 'repository',
    entityType: 'Item',
    filter_fields: [],
    update_fields: [],
    source: 'call',
    support: ['field'],
    gaps: ['Durability unverified'],
  },
  {
    kind: 'mongo_collection_binding',
    id: 'collection',
    entityType: 'Item',
    collection: 'items',
    source: 'entity',
    gaps: [],
  },
  {
    kind: 'mongo_repository_binding',
    id: 'repository',
    repositoryType: 'Repository',
    entityType: 'Item',
    collection_id: 'collection',
    idType: 'String',
    fragments: [],
    methods: [],
    source: 'repository-source',
  },
  {
    kind: 'schema_binding',
    id: 'schema',
    typeName: 'Item',
    direction: 'source',
    properties: [
      {
        name: 'id',
        jsonName: 'id',
        type: 'String',
        source: 'id-field',
        constraints: [],
        views: [],
        presence: 'unknown',
        nullable: 'unknown',
        access: 'declared_field',
        annotations: [{ name: 'Id', arguments: {}, source: 'id-annotation' }],
      },
    ],
    inheritedTypes: [],
    genericArguments: [],
    enumValues: [],
    polymorphism: null,
    completeness: 'partial',
    gaps: [],
    source: 'entity',
    support: ['entity'],
    profiles: [],
  },
];

describe('source data inspection closure', () => {
  it('follows explicit repository and collection IDs into source schemas', () => {
    const result = currentDataRecords(records, ['field']);
    expect(result.map((record) => record.id)).toEqual([
      'read',
      'collection',
      'repository',
      'schema',
    ]);
    const schema = result.find((record) => record.kind === 'schema_binding');
    expect(schema?.direction).toBe('source');
    expect(schema?.completeness).toBe('partial');
  });
  it('retains individual field/annotation provenance and nullable call-less value lineage', () => {
    const schema = records.find((record) => record.kind === 'schema_binding');
    if (schema === undefined) throw new Error('Missing schema fixture');
    expect(currentSourceIds(schema)).toEqual(['entity', 'id-field', 'id-annotation']);
    expect(currentDataRecords(records, ['id-field']).map((record) => record.id)).toEqual([
      'schema',
    ]);
    const value = {
      kind: 'java_value_binding',
      id: 'value',
      relation: 'field_projection',
      from: 'field',
      to: 'returned',
      call: null,
      guards: ['guard'],
    } satisfies CurrentRecord;
    expect(currentSourceIds(value)).toEqual(['field', 'returned']);
    expect(currentDataRecords([value], ['field'])).toEqual([value]);
  });
  it('does not infer a stored collection from unrelated names', () => {
    expect(currentDataRecords(records, ['unknown'])).toEqual([]);
  });
});
