import 'server-only';

import type { SemanticNode } from '@/domain/scan/scan.generated';

import type { BackendGraph } from './backend-semantics';
import type { SyntaxFields, SyntaxNode } from './source-index-types';

function ancestor(
  graph: BackendGraph,
  node: SyntaxNode,
  kinds: readonly string[],
): SyntaxNode | null {
  let parent = node.parent;
  while (parent !== null) {
    const candidate = graph.index.nodes[parent];
    if (!candidate) return null;
    if (kinds.includes(candidate.kind)) return candidate;
    parent = candidate.parent;
  }
  return null;
}

function bindingScope(graph: BackendGraph, variable: SyntaxNode): SyntaxFields[string] {
  const control = ancestor(graph, variable, ['CASE', 'IF', 'CONDITIONAL_EXPRESSION']);
  if (!control) return [];
  if (control.kind === 'CASE') return [[variable.end, control.end]];
  // Compound and negated predicates require further flow-sensitive analysis.
  const condition = control.fields?.condition?.[0];
  const instance = ancestor(graph, variable, ['INSTANCE_OF']);
  if (!condition || !instance) return [];
  const exact = condition[0] === instance.start && condition[1] === instance.end;
  return exact ? (control.fields.consequent ?? []) : [];
}

function isBinding(graph: BackendGraph, syntax: SyntaxNode): boolean {
  if (syntax.kind !== 'VARIABLE' || syntax.symbol === undefined || syntax.symbol === '_') {
    return false;
  }
  return graph.index.nodes[syntax.parent ?? -1]?.kind === 'BINDING_PATTERN';
}

function appendUses(graph: BackendGraph, syntax: SyntaxNode, binding: SemanticNode) {
  const scope = bindingScope(graph, syntax);
  for (const [use, candidate] of graph.nodes) {
    const matching = candidate.nodeKind === 'identifier' && candidate.name === syntax.symbol;
    const inside = scope.some(([start, end]) => use.start >= start && use.end <= end);
    if (matching && inside) {
      graph.edge(
        candidate,
        binding,
        candidate.owner === binding.owner ? 'reaching_definition' : 'captures',
      );
    }
  }
}

/** Named pattern bindings are lexical to a case or a positive if/conditional arm. */
export function appendJavaPatternBindings(graph: BackendGraph): void {
  if (graph.index.language !== 'java') return;
  for (const [syntax, node] of graph.nodes) {
    if (!isBinding(graph, syntax)) continue;
    appendUses(graph, syntax, node);
  }
}
