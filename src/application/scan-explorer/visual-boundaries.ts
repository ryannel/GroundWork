import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';
import type { ExplorerLink, ExplorerNode } from '@/domain/service-explorer';

import { csharpBoundaryNode } from './visual-csharp-boundary';
import { visualFile } from './visual-file';
import type { VisualContext } from './visual-types';

function clientName(type: string): string {
  const base = type.split('<')[0] ?? type;
  return base.split('.').at(-1) ?? base;
}

function groups(records: readonly CurrentRecord[]): ReadonlyMap<string, readonly CurrentRecord[]> {
  const grouped = new Map<string, CurrentRecord[]>();
  for (const record of records) {
    let key: string | null = null;
    if (record.kind === 'mongo_collection_binding') key = record.id;
    if (record.kind === 'outbound_binding') {
      key = `http:${record.client.logical_name ?? record.client.type}`;
    }
    if (record.kind === 'graphql_binding') {
      key = `graphql:${record.client.logical_name ?? record.client.type}`;
    }
    if (record.kind === 'event_binding') key = `event:${record.client.type}`;
    key = csharpGroup(record) ?? key;
    if (key !== null) grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }
  return grouped;
}

function node(
  context: VisualContext,
  id: string,
  records: readonly CurrentRecord[],
): ExplorerNode | null {
  const first = records[0];
  if (first === undefined) return null;
  if (first.kind === 'csharp_symbol_binding') return csharpBoundaryNode(context, first, id);
  if (first.kind === 'mongo_collection_binding') return storeNode(context, { id, first });
  if (first.kind === 'outbound_binding') {
    return {
      id,
      label: `HTTP boundary: ${first.client.logical_name ?? first.client.type}`,
      detail: `${String(records.length)} caller-construction sites. Configured target identity, gateway rewriting and provider/deployment correspondence remain unresolved.`,
      kind: 'call',
      sourceIds: records.flatMap((record) =>
        record.kind === 'outbound_binding' ? [record.source] : [],
      ),
      target: visualFile(context, first.owner_source),
    };
  }
  if (first.kind === 'graphql_binding') return graphqlNode(context, { id, records, first });
  if (first.kind === 'event_binding') {
    return {
      id,
      label: `Message boundary: ${clientName(first.client.type)}`,
      detail:
        'Source event-client operations; broker identity, scheduling, delivery and durable acknowledgement remain unresolved.',
      kind: 'message',
      sourceIds: records.flatMap((record) =>
        record.kind === 'event_binding' ? [record.source] : [],
      ),
      target: visualFile(context, first.owner_source),
    };
  }
  return null;
}

export function visualBoundaries(context: VisualContext): {
  readonly nodes: readonly ExplorerNode[];
  readonly links: readonly ExplorerLink[];
} {
  const nodes = [...groups(context.input.records)].flatMap(([id, records]) => {
    const projected = node(context, `boundary:${id}`, records);
    return projected === null ? [] : [projected];
  });
  return {
    nodes,
    links: nodes.map((item) => ({
      id: `declared:${item.id}`,
      from: context.input.binding.component.id,
      to: item.id,
      label: 'source-declared resource or boundary; effects open in method frames',
      kind: 'interaction',
      sourceIds: item.sourceIds,
    })),
  };
}

function graphqlNode(
  context: VisualContext,
  group: {
    readonly id: string;
    readonly records: readonly CurrentRecord[];
    readonly first: Extract<CurrentRecord, { readonly kind: 'graphql_binding' }>;
  },
): ExplorerNode {
  const { id, records, first } = group;
  return {
    id,
    label: `GraphQL boundary: ${first.client.logical_name ?? first.client.type}`,
    detail:
      'Source GraphQL document, variables and client response selection. Remote component identity, deployment and execution remain unresolved.',
    kind: 'call',
    sourceIds: records.flatMap((record) =>
      record.kind === 'graphql_binding' ? [record.source] : [],
    ),
    target: visualFile(context, first.owner_source),
  };
}

function storeNode(
  context: VisualContext,
  group: {
    readonly id: string;
    readonly first: Extract<CurrentRecord, { readonly kind: 'mongo_collection_binding' }>;
  },
): ExplorerNode {
  const { id, first } = group;
  const schema = context.input.records.find(
    (record) => record.kind === 'schema_binding' && record.typeName === first.entityType,
  );
  return {
    id,
    label: `Collection: ${first.collection ?? 'unresolved name'}`,
    detail: `Source-declared Mongo resource for ${first.entityType}. Physical database component and persistence guarantees remain unresolved.`,
    kind: 'storage',
    sourceIds: [first.source],
    target: schema === undefined ? null : visualFile(context, schema.id),
  };
}

function csharpGroup(record: CurrentRecord): string | null {
  if (record.kind !== 'csharp_symbol_binding' || record.relation !== 'call_target') return null;
  return ['http', 'storage', 'async'].includes(record.boundary)
    ? `${record.boundary}:${record.symbol}`
    : null;
}
