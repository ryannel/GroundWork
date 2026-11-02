import type {
  ExceptionBinding,
  AsyncBinding,
  MongoOperationBinding,
  SemanticNode,
} from '@/domain/scan/scan.generated';
import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';
import type { ExplorerNode } from '@/domain/service-explorer';

import { visualBoundaryNode } from './visual-boundary';
import { visualFile } from './visual-file';
import type { VisualContext } from './visual-types';

function nodeKind(node: SemanticNode, root: string): ExplorerNode['kind'] {
  if (node.id === root) return 'entry';
  if (['if', 'conditional', 'loop'].includes(node.nodeKind)) return 'branch';
  if (['throw', 'catch'].includes(node.nodeKind)) return 'failure';
  if (node.nodeKind === 'await') return 'async';
  return node.nodeKind === 'return' ? 'return' : 'call';
}

function callTarget(context: VisualContext, node: SemanticNode): string | null {
  const bindings = context.recordsAt.get(node.source) ?? [];
  const java = bindings.find((record) => record.kind === 'java_call_binding');
  if (java?.kind === 'java_call_binding' && java.resolution === 'exact' && java.target !== null) {
    return visualFile(context, java.target);
  }
  const csharp = bindings.find(
    (record) => record.kind === 'csharp_symbol_binding' && record.relation === 'call_target',
  );
  if (
    csharp?.kind === 'csharp_symbol_binding' &&
    csharp.dispatch === 'exact' &&
    csharp.target !== null
  ) {
    return visualFile(context, csharp.target);
  }
  return semanticTarget(context, node);
}

function semanticTarget(context: VisualContext, node: SemanticNode): string | null {
  const targets = [
    ...new Set(
      (context.edges.get(node.id) ?? [])
        .filter((edge) => edge.relation === 'call_target')
        .map((edge) => edge.to),
    ),
  ];
  if (targets.length !== 1) return null;
  const id = targets[0];
  const target = id === undefined ? undefined : context.nodes.get(id);
  return target?.nodeKind === 'function' ? visualFile(context, target.source) : null;
}

function boundary(record: CurrentRecord, source: string): boolean {
  if (record.kind === 'async_binding') {
    return record.invocations.some((invocation) => invocation.call_source === source);
  }
  return record.kind === 'mongo_operation_binding' && record.source === source;
}

function storageNode(
  context: VisualContext,
  node: SemanticNode,
  storage: MongoOperationBinding,
): ExplorerNode {
  const schema = context.input.records.find(
    (record) => record.kind === 'schema_binding' && record.typeName === storage.entityType,
  );
  return {
    id: node.id,
    label: `${storage.operation}: ${storage.entityType.split('.').at(-1) ?? storage.entityType}`,
    detail: `${storage.method}; source collection ${storage.collection_id}. ${storage.gaps.join(' ')}`,
    kind: 'storage',
    sourceIds: [node.source],
    target: schema === undefined ? null : visualFile(context, schema.id),
  };
}

function asyncNode(
  context: VisualContext,
  node: SemanticNode,
  binding: AsyncBinding,
): ExplorerNode {
  return {
    id: node.id,
    label: nodeLabel(node),
    detail: `${node.syntax.slice(0, 500)} · Source @Async declaration; proxy dispatch, scheduling and completion remain unverified`,
    kind: 'async',
    sourceIds: [node.source, binding.annotation_source],
    target: visualFile(context, binding.source),
  };
}

function nodeLabel(node: SemanticNode): string {
  const label = node.nodeKind === 'function' ? (node.name ?? node.syntax) : node.syntax;
  return label.replaceAll(/\s+/gu, ' ').slice(0, 90);
}

export function visualNode(context: VisualContext, node: SemanticNode, root: string): ExplorerNode {
  const exception = (context.recordsAt.get(node.source) ?? []).find(
    (record) => record.kind === 'exception_binding' && record.throw_source_id === node.source,
  );
  if (exception?.kind === 'exception_binding') return failureNode(context, node, exception);
  const effect = (context.recordsAt.get(node.source) ?? []).find((record) =>
    boundary(record, node.source),
  );
  if (effect?.kind === 'mongo_operation_binding') return storageNode(context, node, effect);
  if (effect?.kind === 'async_binding') return asyncNode(context, node, effect);
  const outward = visualBoundaryNode(context, node);
  if (outward !== null) return outward;
  return {
    id: node.id,
    label: nodeLabel(node),
    detail: node.syntax.slice(0, 700),
    kind: nodeKind(node, root),
    sourceIds: [node.source],
    target: callTarget(context, node),
  };
}

function failureNode(
  context: VisualContext,
  node: SemanticNode,
  binding: ExceptionBinding,
): ExplorerNode {
  const handler = binding.candidates.length === 1 ? binding.candidates[0] : undefined;
  const status = handler?.response_status ?? 'unresolved response';
  return {
    id: node.id,
    label: `${binding.thrown_type.split('.').at(-1) ?? binding.thrown_type} · ${status}`,
    detail: `Source-declared handler mapping. ${binding.uncertainties.join(' ')}`,
    kind: 'failure',
    sourceIds: [
      node.source,
      ...(handler === undefined ? [] : [handler.handler_source_id, handler.advice_source_id]),
    ],
    target: handler === undefined ? null : visualFile(context, handler.handler_source_id),
  };
}
