import 'server-only';

export interface MongoCollectionBinding {
  readonly kind: 'mongo_collection_binding';
  readonly id: string;
  readonly entityType: string;
  readonly collection: string | null;
  readonly source: string;
  readonly gaps: readonly string[];
}
export interface MongoRepositoryMethod {
  readonly name: string;
  readonly operation: 'read' | 'write' | 'unknown';
  readonly source: string;
  readonly readPreference: string | null;
}
export interface MongoRepositoryBinding {
  readonly kind: 'mongo_repository_binding';
  readonly id: string;
  readonly repositoryType: string;
  readonly entityType: string;
  readonly collection_id: string;
  readonly idType: string;
  readonly fragments: readonly {
    readonly interfaceType: string;
    readonly implementationType: string | null;
    readonly source: string;
  }[];
  readonly methods: readonly MongoRepositoryMethod[];
  readonly source: string;
}
export interface MongoOperationBinding {
  readonly kind: 'mongo_operation_binding';
  readonly id: string;
  readonly receiverType: string;
  readonly receiver_source: string;
  readonly method: string;
  readonly operation: 'read' | 'write' | 'unknown';
  readonly collection_id: string;
  readonly repository_id: string | null;
  readonly entityType: string;
  readonly filter_fields: readonly string[];
  readonly update_fields: readonly {
    readonly operator: '$set' | '$setOnInsert';
    readonly field: string;
    readonly source: string;
  }[];
  readonly source: string;
  readonly support: readonly string[];
  readonly gaps: readonly string[];
}
export type MongoBinding = MongoCollectionBinding | MongoRepositoryBinding | MongoOperationBinding;
