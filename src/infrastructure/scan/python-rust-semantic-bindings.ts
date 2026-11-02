import 'server-only';

import type { SemanticNode } from '@/domain/scan/scan.generated';

import type { BackendGraph } from './backend-semantics';
import { polyglotFields } from './python-rust-fields';
import type { SyntaxNode } from './source-index-types';

function rebound(graph: BackendGraph, name: string): boolean {
  return graph.index.nodes.some((node) =>
    polyglotFields(graph.index, node, 'targets').some((target) => target.symbol === name),
  );
}
function eligible(graph: BackendGraph, definition: SyntaxNode, name: string): boolean {
  const moduleFunction =
    definition.kind === 'METHOD' && definition.parent === 0 && definition.symbol === name;
  const unwrapped = (definition.fields?.annotations?.length ?? 0) === 0;
  return moduleFunction && unwrapped && !rebound(graph, name);
}
function bindCall(graph: BackendGraph, syntax: SyntaxNode, call: SemanticNode): void {
  const callee = polyglotFields(graph.index, syntax, 'callee')[0];
  if (callee?.kind !== 'IDENTIFIER' || callee.symbol === undefined) return;
  const targets = graph.index.nodes.filter((definition) =>
    eligible(graph, definition, callee.symbol ?? ''),
  );
  const target = targets[0];
  if (targets.length !== 1 || target === undefined) return;
  const parameterShadow = graph.index.nodes.some(
    (node) =>
      node.kind === 'METHOD' &&
      polyglotFields(graph.index, node, 'parameters').some(
        (parameter) => parameter.symbol === callee.symbol,
      ),
  );
  if (parameterShadow) return;
  const declaration = graph.nodes.get(target);
  if (declaration) {
    graph.edge(
      call,
      declaration,
      'call_target',
      undefined,
      'unambiguous module-local direct source call',
    );
  }
}
/** Only unambiguous module-local direct calls; decorators, receivers and rebinding stay unresolved. */
export function appendPythonRustCallTargets(graph: BackendGraph): void {
  if (!['python', 'rust'].includes(graph.index.language)) return;
  for (const [syntax, call] of graph.nodes) {
    if (call.nodeKind === 'call') bindCall(graph, syntax, call);
  }
}
