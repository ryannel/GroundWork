import { scanRecords, type ScanRecord } from '@/domain/scan/scan-records';
import type { ScanDocument } from '@/domain/scan/scan.generated';

function references(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((entry: unknown) => references(entry));
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(references);
}

function closure(document: ScanDocument, initial: readonly ScanRecord[]): readonly string[] {
  const all = new Map(scanRecords(document).map((record) => [record.id, record]));
  const selected = new Set<string>();
  const pending = initial.map((record) => record.id);
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || selected.has(id)) continue;
    const record = all.get(id);
    if (!record) throw new Error(`Missing selected record ${id}`);
    selected.add(id);
    for (const reference of references(record)) {
      if (all.has(reference) && !selected.has(reference)) pending.push(reference);
    }
  }
  return [...selected].toSorted((left, right) => left.localeCompare(right));
}

/** Selection uses identities and ownership; referenced sources/hosts are explicit requested IDs. */
export function bindingReviewSelection(document: ScanDocument): readonly string[] {
  const bindings = document.bindings ?? [];
  const nodes = (document.semantic ?? []).filter((record) => record.kind === 'semantic_node');
  const semanticSources = new Set(nodes.map((record) => record.source));
  const owners = new Set(
    nodes.filter((record) => record.nodeKind === 'function').map((record) => record.source),
  );
  const outbound = bindings.filter((record) => 'call_binding_ids' in record);
  const outboundCalls = new Set(outbound.flatMap((record) => record.call_binding_ids));
  const outboundValues = new Set(outbound.flatMap((record) => record.value_binding_ids));
  const registrySources = new Set(
    outbound.flatMap((record) =>
      'client' in record && 'registry_source' in record.client
        ? [record.client.registry_source]
        : [],
    ),
  );
  const calls = bindings
    .filter((record) => record.kind === 'java_call_binding')
    .filter((record) => {
      const native =
        semanticSources.has(record.call) || (record.caller !== null && owners.has(record.caller));
      return native || outboundCalls.has(record.id) || registrySources.has(record.call);
    });
  const callSources = new Set(calls.map((call) => call.call));
  const values = bindings
    .filter((record) => record.kind === 'java_value_binding')
    .filter((record) => {
      const native = semanticSources.has(record.from) || semanticSources.has(record.to);
      return (
        native ||
        outboundValues.has(record.id) ||
        (record.call !== null && callSources.has(record.call))
      );
    });
  return closure(document, [
    ...(document.framework ?? []),
    ...(document.semantic ?? []),
    ...document.summaries,
    ...document.gaps,
    ...outbound,
    ...calls,
    ...values,
    ...bindings.filter((record) =>
      [
        'exception_binding',
        'mongo_collection_binding',
        'mongo_repository_binding',
        'mongo_operation_binding',
        'java_constant_binding',
        'java_collection_binding',
        'schedule_binding',
        'graphql_document_binding',
        'consumer_binding',
        'configuration_binding',
        'enum_binding',
      ].includes(record.kind),
    ),
  ]);
}
