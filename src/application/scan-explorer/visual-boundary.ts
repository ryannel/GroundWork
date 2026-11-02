import type {
  EventBinding,
  GraphqlBinding,
  OutboundBinding,
  SemanticNode,
  CsharpSymbolBinding,
} from '@/domain/scan/scan.generated';
import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';
import type { ExplorerField, ExplorerNode, ExplorerPage } from '@/domain/service-explorer';

import { csharpBoundaryNode, csharpBoundaryPage } from './visual-csharp-boundary';
import { visualFile } from './visual-file';
import { visualPage } from './visual-page';
import type { VisualContext } from './visual-types';

const RESPONSE_TYPE = 'Response declared type';
type Boundary = OutboundBinding | GraphqlBinding | EventBinding | CsharpSymbolBinding;
export function isVisualBoundary(record: CurrentRecord): record is Boundary {
  if (record.kind === 'csharp_symbol_binding') {
    return (
      record.relation === 'call_target' && ['http', 'storage', 'async'].includes(record.boundary)
    );
  }
  return ['outbound_binding', 'graphql_binding', 'event_binding'].includes(record.kind);
}
function expression(context: VisualContext, source: string): string {
  return (
    [...context.nodes.values()].find((node) => node.source === source)?.syntax.slice(0, 400) ??
    'Source expression not expanded in this selection'
  );
}
function expressions(context: VisualContext, ids: readonly string[]): string {
  return ids.length === 0
    ? 'Value not expanded'
    : ids.map((id) => expression(context, id)).join(' · ');
}
function field(name: string, type: string, sourceIds: readonly string[]): ExplorerField {
  return { name, type, sourceIds, required: 'unknown', nullable: 'unknown' };
}
function outboundFields(context: VisualContext, record: OutboundBinding): ExplorerField[] {
  return [
    field('Request method', record.request.method, [record.request.method_source]),
    field('Request address', record.request.template ?? 'Dynamic address; provider unresolved', [
      record.request.uri_source,
    ]),
    ...record.request.argument_sources.map((id, i) =>
      field(`URI argument ${String(i + 1)}`, expression(context, id), [id]),
    ),
    ...record.request.headers.map((header) =>
      field(
        `Header ${header.name ?? 'unresolved name'}`,
        expressions(context, header.value_sources),
        [header.source, ...header.value_sources],
      ),
    ),
    ...record.request.body_sources.map((id, i) =>
      field(`Body construction ${String(i + 1)}`, expression(context, id), [id]),
    ),
    field(RESPONSE_TYPE, record.response.type ?? 'Unresolved source type', [
      record.response.type_source ?? record.response.body_source,
    ]),
  ];
}
function graphqlFields(context: VisualContext, record: GraphqlBinding): ExplorerField[] {
  return [
    field('GraphQL document', record.document_name ?? 'Dynamic document', [record.document_source]),
    ...record.variables.map((variable) =>
      field(
        `Variable ${variable.name ?? 'unresolved name'}`,
        expressions(context, variable.value_sources),
        [variable.source, ...variable.value_sources],
      ),
    ),
    field('Response field', record.response.field_path ?? 'Unresolved field selection', [
      record.response.field_source ?? record.response.body_source,
    ]),
    field(RESPONSE_TYPE, record.response.type ?? 'Unresolved source type', [
      record.response.type_source ?? record.response.body_source,
    ]),
  ];
}
function eventFields(context: VisualContext, record: EventBinding): ExplorerField[] {
  return [
    ...record.arguments.map((argument) =>
      field(
        `Message ${argument.role} (${String(argument.position)})`,
        `${argument.type ?? 'Unresolved type'} · ${expression(context, argument.source)}`,
        [argument.source],
      ),
    ),
    ...record.constructions.flatMap((construction) =>
      construction.fields.map((item) =>
        field(`Payload ${item.field}`, expression(context, item.value_source), [
          construction.source,
          item.field_source,
          item.value_source,
        ]),
      ),
    ),
    field('Send result observation', record.result_observation, [record.source]),
  ];
}
function title(record: Boundary): string {
  if (record.kind === 'csharp_symbol_binding') return record.symbol;
  if (record.kind === 'event_binding') return `Message ${record.operation}`;
  const client = record.client.logical_name ?? 'Unresolved target';
  if (record.kind === 'graphql_binding') {
    return `${client} · GraphQL ${record.document_name ?? 'dynamic document'}`;
  }
  return `${client} · ${record.request.method} ${record.request.template ?? 'dynamic address'}`;
}
export function visualBoundaryNode(
  context: VisualContext,
  node: SemanticNode,
): ExplorerNode | null {
  const record = (context.recordsAt.get(node.source) ?? []).find(
    (item) => isVisualBoundary(item) && item.source === node.source,
  );
  if (record === undefined || !isVisualBoundary(record)) return null;
  if (record.kind === 'csharp_symbol_binding') return csharpBoundaryNode(context, record, node.id);
  return {
    id: node.id,
    label: title(record),
    detail:
      'Source caller construction. Open request, response or message data and their anchors. Target deployment and effective wire behaviour remain unverified.',
    kind: record.kind === 'event_binding' ? 'message' : 'call',
    sourceIds: [record.source],
    target: visualFile(context, record.id),
  };
}
export function visualBoundaryPage(context: VisualContext, record: Boundary): ExplorerPage {
  if (record.kind === 'csharp_symbol_binding') return csharpBoundaryPage(context, record);
  const fields =
    record.kind === 'outbound_binding'
      ? outboundFields(context, record)
      : otherFields(context, record);
  return visualPage(context, {
    kind: 'data',
    title: title(record),
    description:
      'Caller-built request or publication and source-declared response. These fields are construction roles; required/nullable wire semantics are unknown. Provider contracts remain separate.',
    nodes: fields.map((item, i) => ({
      id: `boundary-field:${String(i)}`,
      label: item.name,
      detail: item.type,
      kind: 'schema',
      sourceIds: item.sourceIds,
      target: responseSchema(context, record, item.name),
    })),
    links: [],
    fields,
    gaps: [
      ...record.gaps,
      'Source construction does not prove activation, delivery, persisted state or effective wire formatting',
      'An absent body/variable record does not prove that the effective wire request omits it',
    ],
    completeSelection: record.completeness === 'source_path',
  });
}
function otherFields(
  context: VisualContext,
  record: GraphqlBinding | EventBinding,
): ExplorerField[] {
  return record.kind === 'graphql_binding'
    ? graphqlFields(context, record)
    : eventFields(context, record);
}
function responseSchema(context: VisualContext, record: Boundary, name: string): string | null {
  if (
    name !== RESPONSE_TYPE ||
    record.kind === 'event_binding' ||
    record.kind === 'csharp_symbol_binding'
  ) {
    return null;
  }
  const schema = context.input.records.find(
    (item) => item.kind === 'schema_binding' && item.typeName === record.response.type,
  );
  return schema === undefined ? null : visualFile(context, schema.id);
}
