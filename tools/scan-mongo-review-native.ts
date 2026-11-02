import type { Source } from '@/domain/scan/scan.generated';
import type { MongoBinding, MongoOperationBinding } from '@/infrastructure/scan/spring-mongo-types';

interface ExpectedOperation {
  readonly file: string;
  readonly collection: string;
  readonly method: string;
  readonly operation: 'read' | 'write';
  readonly count: number;
}

const COLLECTIONS = [
  ['Customer', 'customers', 'CustomerRepository'],
  ['CustomerArchive', 'archived_customers', 'CustomerArchiveRepository'],
  ['CustomerAuditLog', 'auditLogs', 'AuditLogRepository'],
] as const;

/** Independent source inventory: literal collection identities and every data-operation callsite. */
const CUSTOMER_SERVICE = 'customer/CustomerService.java';
const EXPECTED: readonly ExpectedOperation[] = [
  ...['findByCustomerId', 'findByCustomerIdIn', 'findAllByArchivalDataArchivedTimestampBefore'].map(
    (method) => ({
      file: CUSTOMER_SERVICE,
      collection: 'customers',
      method,
      operation: 'read' as const,
      count: 1,
    }),
  ),
  ...['deleteByCustomerId', 'saveAll'].map((method) => ({
    file: CUSTOMER_SERVICE,
    collection: 'customers',
    method,
    operation: 'write' as const,
    count: 1,
  })),
  {
    file: CUSTOMER_SERVICE,
    collection: 'customers',
    method: 'save',
    operation: 'write',
    count: 2,
  },
  ...['insert', 'save', 'deleteByCustomerId'].map((method) => ({
    file: 'migrate/MigrationService.java',
    collection: 'customers',
    method,
    operation: 'write' as const,
    count: 1,
  })),
  {
    file: 'migrate/MigrationService.java',
    collection: 'customers',
    method: 'findByCustomerId',
    operation: 'read',
    count: 1,
  },
  {
    file: 'customerarchive/CustomerArchiveService.java',
    collection: 'archived_customers',
    method: 'findByCustomerId',
    operation: 'read',
    count: 1,
  },
  ...['delete', 'upsertCustomerArchive'].map((method) => ({
    file: 'customerarchive/CustomerArchiveService.java',
    collection: 'archived_customers',
    method,
    operation: 'write' as const,
    count: 1,
  })),
  {
    file: 'customerarchive/CustomerArchiveUpsertRepositoryImpl.java',
    collection: 'archived_customers',
    method: 'upsert',
    operation: 'write',
    count: 1,
  },
  ...['findByCustomerIdAndVersion', 'findAllByCustomerIdOrderByVersionDesc'].map((method) => ({
    file: 'auditlog/AuditLogService.java',
    collection: 'auditLogs',
    method,
    operation: 'read' as const,
    count: 1,
  })),
  {
    file: 'auditlog/AuditLogService.java',
    collection: 'auditLogs',
    method: 'save',
    operation: 'write',
    count: 1,
  },
  ...['customers', 'archived_customers'].map((collection) => ({
    file: 'migration/Change1RepublishCustomerAnalyticsEvents.java',
    collection,
    method: 'stream',
    operation: 'read' as const,
    count: 1,
  })),
];

function archiveUpdate(operations: readonly MongoOperationBinding[]): boolean {
  const upsert = operations.filter((operation) => operation.method === 'upsert');
  if (upsert.length !== 1) return false;
  return (
    upsert[0]?.filter_fields.includes('customerId') === true &&
    ['$setOnInsert:created', '$set:modified', '$set:customerId', '$set:customer'].every(
      (value) =>
        upsert[0]?.update_fields.some((field) => `${field.operator}:${field.field}` === value) ===
        true,
    )
  );
}

function receiverProof(
  operations: readonly MongoOperationBinding[],
  repositories: readonly Extract<MongoBinding, { readonly kind: 'mongo_repository_binding' }>[],
  sourceById: ReadonlyMap<string, Source>,
): boolean {
  return operations.every(
    (operation) =>
      sourceById.has(operation.receiver_source) &&
      sourceById.has(operation.source) &&
      (operation.repository_id === null
        ? operation.receiverType === 'org.springframework.data.mongodb.core.MongoTemplate'
        : repositories.some(
            (repository) =>
              repository.id === operation.repository_id &&
              repository.repositoryType === operation.receiverType,
          )),
  );
}

/** Proves Q14 source operations, without asserting deployed databases, durable success or transactionality. */
export function mongoCollectionsProof(
  bindings: readonly MongoBinding[],
  sources: readonly Source[],
): Readonly<Record<string, boolean>> {
  const collections = bindings.filter((binding) => binding.kind === 'mongo_collection_binding');
  const repositories = bindings.filter((binding) => binding.kind === 'mongo_repository_binding');
  const operations = bindings.filter((binding) => binding.kind === 'mongo_operation_binding');
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const identities = COLLECTIONS.every(([entity, collection, repository]) => {
    const found = collections.filter(
      (binding) => binding.entityType.endsWith(`.${entity}`) && binding.collection === collection,
    );
    return (
      found.length === 1 &&
      repositories.some(
        (binding) =>
          binding.repositoryType.endsWith(`.${repository}`) &&
          binding.collection_id === found[0]?.id &&
          binding.entityType === found[0].entityType,
      )
    );
  });
  const catalogue =
    operations.length === EXPECTED.reduce((count, operation) => count + operation.count, 0) &&
    EXPECTED.every(
      (expected) =>
        operations.filter(
          (operation) =>
            operation.method === expected.method &&
            operation.operation === expected.operation &&
            sourceById.get(operation.source)?.path.endsWith(`/${expected.file}`) === true &&
            collections.some(
              (collection) =>
                collection.id === operation.collection_id &&
                collection.collection === expected.collection,
            ),
        ).length === expected.count,
    );
  const receiverBindings = receiverProof(operations, repositories, sourceById);
  const fragment = repositories.some(
    (repository) =>
      repository.repositoryType.endsWith('.CustomerArchiveRepository') &&
      repository.fragments.some(
        (entry) =>
          entry.interfaceType.endsWith('.CustomerArchiveUpsertRepository') &&
          entry.implementationType?.endsWith('.CustomerArchiveUpsertRepositoryImpl') === true,
      ),
  );
  const proof = {
    collectionIdentities: identities,
    completeSourceOperationCatalogue: catalogue,
    receiverBindings,
    archiveFragment: fragment,
    archiveUpsertFields: archiveUpdate(operations),
  };
  return { ...proof, supported: Object.values(proof).every(Boolean) };
}
