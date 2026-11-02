import type { ScanDocument, SemanticNode } from '@/domain/scan/scan.generated';
import type { CallBinding, ValueBinding } from '@/infrastructure/scan/java-call-binding-types';

import { semanticGraph, targets, type SemanticGraph } from './scan-semantic-query';

export interface ProfileGraph extends SemanticGraph {
  readonly calls: readonly CallBinding[];
  readonly values: readonly ValueBinding[];
  readonly bySource: ReadonlyMap<string, SemanticNode>;
}
export function profileGraph(document: ScanDocument): ProfileGraph {
  const graph = semanticGraph(document);
  const bindings = document.bindings ?? [];
  return {
    ...graph,
    calls: bindings.filter((binding) => binding.kind === 'java_call_binding'),
    values: bindings.filter((binding) => binding.kind === 'java_value_binding'),
    bySource: new Map(graph.nodes.map((node) => [node.source, node])),
  };
}

export function profileMethod(
  graph: ProfileGraph,
  file: string,
  name: string,
): readonly SemanticNode[] {
  const sources = new Set(
    graph.document.sources
      .filter((source) => source.path.endsWith(`/${file}.java`))
      .map((s) => s.id),
  );
  return graph.nodes.filter(
    (node) => node.nodeKind === 'function' && node.name === name && sources.has(node.source),
  );
}

export function profileCall(
  graph: ProfileGraph,
  source: string,
  method: string,
): SemanticNode | undefined {
  const call = graph.calls.find(
    (binding) => binding.call === source && binding.methodName === method,
  );
  const node = graph.bySource.get(source);
  const callee = targets(graph, node, 'callee')[0];
  return call && callee?.name === method ? node : undefined;
}

export function profileReceiver(
  graph: ProfileGraph,
  call: SemanticNode | undefined,
): SemanticNode | undefined {
  return targets(graph, targets(graph, call, 'callee')[0], 'receiver')[0];
}

export function profileReference(graph: ProfileGraph, declaration: string, use: string): boolean {
  return graph.values.some(
    (value) => value.relation === 'reference' && value.from === declaration && value.to === use,
  );
}

export function profileReturned(graph: ProfileGraph, owner: SemanticNode, source: string): boolean {
  return graph.nodes
    .filter((node) => node.owner === owner.owner && node.nodeKind === 'return')
    .some((node) => targets(graph, node, 'returns').some((value) => value.source === source));
}

export function profileInput(graph: ProfileGraph, owner: SemanticNode, use: string): boolean {
  return targets(graph, owner, 'parameter').some((parameter) =>
    profileReference(graph, parameter.source, use),
  );
}

/** Resolve parsed scalar atoms through explicit declaration/reference relations only. */
export function profileScalar(graph: ProfileGraph, source: string): string | undefined {
  const pending = [source];
  const seen = new Set<string>();
  while (pending.length > 0 && seen.size < 32) {
    const current = pending.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    const node = graph.bySource.get(current);
    if (node?.nodeKind === 'literal' && typeof node.value === 'string') return node.value;
    const constant = graph.document.bindings?.find(
      (record) => record.kind === 'java_constant_binding' && record.source === current,
    );
    if (constant?.kind === 'java_constant_binding' && typeof constant.value === 'string') {
      return constant.value;
    }
    pending.push(
      ...graph.values
        .filter((value) => value.relation === 'reference' && value.to === current)
        .map((value) => value.from),
    );
  }
  return undefined;
}
