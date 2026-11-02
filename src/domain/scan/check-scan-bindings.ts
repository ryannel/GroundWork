import { referencesFor } from './check-scan-answers';
import { archiveBindingSources, isArchiveBinding } from './check-scan-archive-bindings';
import { bindingOwnershipErrors } from './check-scan-binding-ownership';
import { clientBindingSources, isClientBinding } from './check-scan-client-bindings';
import { eventBindingSources, isEventBinding } from './check-scan-event-bindings';
import { isMessageBinding, messageBindingSources } from './check-scan-message-bindings';
import { scanReference, type ScanRecords } from './scan-records';
import type { BindingRecord, OutboundBinding, ScanDocument } from './scan.generated';

function bindingSources(record: BindingRecord): readonly string[] {
  if (record.kind === 'csharp_symbol_binding') {
    return [
      record.source,
      record.target,
      record.owner,
      ...record.configurationSources,
      ...record.arguments.flatMap((argument) => [argument.source, argument.parameter]),
    ].filter((id) => id !== null);
  }
  return otherBindingSources(record);
}
function otherBindingSources(
  record: Exclude<BindingRecord, { readonly kind: 'csharp_symbol_binding' }>,
): readonly string[] {
  if (isArchiveBinding(record)) return archiveBindingSources(record);
  if (isClientBinding(record)) return clientBindingSources(record);
  if (isEventBinding(record)) return eventBindingSources(record);
  if (isMessageBinding(record)) return messageBindingSources(record);
  switch (record.kind) {
    case 'java_call_binding': {
      return [record.call, record.caller, record.receiver, record.target, ...record.guards].filter(
        (id) => id !== null,
      );
    }
    case 'java_value_binding': {
      return [record.from, record.to, record.call, ...record.guards].filter((id) => id !== null);
    }
    case 'mongo_collection_binding': {
      return [record.source];
    }
    case 'mongo_repository_binding': {
      return [
        record.source,
        ...record.fragments.map((fragment) => fragment.source),
        ...record.methods.map((method) => method.source),
      ];
    }
    case 'mongo_operation_binding': {
      return [
        record.source,
        record.receiver_source,
        ...record.support,
        ...record.update_fields.map((field) => field.source),
      ];
    }
    case 'outbound_binding': {
      return outboundSources(record);
    }
    case 'exception_binding': {
      return exceptionSources(record);
    }
  }
}

function exceptionSources(
  record: Extract<BindingRecord, { readonly kind: 'exception_binding' }>,
): readonly string[] {
  return [
    record.throw_source_id,
    ...record.source_ids,
    record.throwing_method_source_id,
    ...record.constructor_argument_source_ids,
    ...record.guard_source_ids,
    ...record.enclosing_try_source_ids,
    ...record.local_controller_handler_source_ids,
    ...record.candidates.flatMap((candidate) => [
      candidate.advice_source_id,
      candidate.handler_source_id,
      ...candidate.response_return_source_ids,
      ...candidate.response_construction_source_ids,
      ...candidate.response_construction_owners.flatMap((owner) => [
        owner.source_id,
        owner.owner_method_source_id,
      ]),
      ...candidate.support_source_ids,
    ]),
  ];
}
function outboundSources(record: OutboundBinding): readonly string[] {
  return [
    record.source,
    record.owner_source,
    record.client.receiver_source,
    record.client.registry_source,
    record.request.method_source,
    record.request.uri_source,
    ...record.request.argument_sources,
    ...record.request.headers.flatMap((header) => [header.source, ...header.value_sources]),
    ...record.request.accept_sources,
    ...record.request.body_sources,
    record.response.type_source,
    record.response.body_source,
    ...record.response.return_sources,
    ...record.failure_paths.flatMap((failure) => [failure.source, failure.thrown_source]),
    ...record.support,
  ].filter((id) => id !== null);
}
function pinErrors(record: BindingRecord, records: ScanRecords): readonly string[] {
  const ids = bindingSources(record);
  const primary = scanReference(records, ids[0] ?? '', 'source');
  if (!primary) return [`${record.id}: binding needs a primary source`];
  return ids.flatMap((id) => {
    const source = scanReference(records, id, 'source');
    return source && (source.repo !== primary.repo || source.commit !== primary.commit)
      ? [`${record.id}: binding source ${id} crosses repository or commit`]
      : [];
  });
}
function collectionErrors(record: BindingRecord, records: ScanRecords): readonly string[] {
  if (record.kind !== 'mongo_repository_binding' && record.kind !== 'mongo_operation_binding') {
    return [];
  }
  const collection = scanReference(records, record.collection_id, 'mongo_collection_binding');
  const errors = referencesFor(records)(
    [record.collection_id],
    ['mongo_collection_binding'],
    record.id,
  );
  if (collection) {
    errors.push(...linkedPinErrors(record, collection, records));
    if (record.entityType !== collection.entityType) {
      errors.push(`${record.id}: entity must match collection binding`);
    }
  }
  if (record.kind !== 'mongo_operation_binding' || record.repository_id === null) return errors;
  errors.push(
    ...referencesFor(records)([record.repository_id], ['mongo_repository_binding'], record.id),
  );
  const repository = scanReference(records, record.repository_id, 'mongo_repository_binding');
  if (!repository) return errors;
  errors.push(...linkedPinErrors(record, repository, records));
  if (
    repository.collection_id !== record.collection_id ||
    repository.repositoryType !== record.receiverType
  ) {
    errors.push(`${record.id}: repository receiver and collection must match operation`);
  }
  return errors;
}
function linkedPinErrors(
  record: BindingRecord,
  target: BindingRecord,
  records: ScanRecords,
): readonly string[] {
  const left = scanReference(records, bindingSources(record)[0] ?? '', 'source');
  const right = scanReference(records, bindingSources(target)[0] ?? '', 'source');
  if (!left || !right) return [];
  return left.repo !== right.repo || left.commit !== right.commit
    ? [`${record.id}: binding reference ${target.id} crosses repository or commit`]
    : [];
}
function outboundLinkErrors(record: BindingRecord, records: ScanRecords): readonly string[] {
  if (!('call_binding_ids' in record)) return [];
  return [
    ...record.call_binding_ids.flatMap((id) => [
      ...referencesFor(records)([id], ['java_call_binding'], record.id),
      ...linkedTargetErrors(record, scanReference(records, id, 'java_call_binding'), records),
    ]),
    ...record.value_binding_ids.flatMap((id) => [
      ...referencesFor(records)([id], ['java_value_binding'], record.id),
      ...linkedTargetErrors(record, scanReference(records, id, 'java_value_binding'), records),
    ]),
  ];
}
function linkedTargetErrors(
  record: BindingRecord,
  target: BindingRecord | undefined,
  records: ScanRecords,
): readonly string[] {
  return target ? linkedPinErrors(record, target, records) : [];
}
/** Canonical bindings retain typed references, pinned evidence and source ownership. */
export function bindingErrors(document: ScanDocument, records: ScanRecords): readonly string[] {
  return (document.bindings ?? []).flatMap((record) => [
    ...referencesFor(records)(bindingSources(record), ['source'], record.id),
    ...pinErrors(record, records),
    ...collectionErrors(record, records),
    ...outboundLinkErrors(record, records),
    ...bindingOwnershipErrors({ document, records }, record),
  ]);
}
