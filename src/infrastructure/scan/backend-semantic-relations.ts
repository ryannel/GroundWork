import 'server-only';

import type { SemanticNode } from '@/domain/scan/scan.generated';

import { appendJavaPatternBindings } from './backend-java-patterns';
import type { BackendGraph } from './backend-semantics';
import { appendSqlBindings } from './backend-sql-bindings';
import { fieldExpressions } from './source-expressions';
import type { SyntaxNode } from './source-index-types';
import { spanKey } from './source-node-lookups';

function fieldNodes(graph: BackendGraph, syntax: SyntaxNode, field: string): SemanticNode[] {
  return (syntax.fields?.[field] ?? []).flatMap(([start, end]) => {
    const entry = graph.semanticSpans.get(spanKey(start, end));
    return entry ? [entry] : [];
  });
}

function appendOrder(graph: BackendGraph, syntax: SyntaxNode) {
  const statements = fieldNodes(graph, syntax, 'statements');
  for (const [position, statement] of statements.entries()) {
    const next = statements[position + 1];
    if (next) graph.edge(statement, next, 'next', position, 'normal completion only');
  }
}

function appendAssignment(graph: BackendGraph, syntax: SyntaxNode, node: SemanticNode) {
  const values = fieldNodes(graph, syntax, 'values');
  if (values.length === 0) return;
  const targets = fieldNodes(graph, syntax, 'targets');
  if (syntax.kind === 'VARIABLE' && syntax.symbol !== undefined && syntax.symbol !== '_') {
    targets.push(graph.extra(node, 'identifier', syntax.symbol, 'binding'));
    graph.edge(node, targets[0] ?? node, 'target', 0);
  }
  for (const [position, target] of targets.entries()) {
    const value = values[position] ?? (values.length === 1 ? values[0] : undefined);
    if (value) graph.edge(target, value, 'assigned_value', position);
    graph.edge(node, target, 'assigns', position);
    if (value?.owner === target.owner) appendReaching(graph, syntax, target);
  }
}

function appendReaching(graph: BackendGraph, assignment: SyntaxNode, target: SemanticNode) {
  if (target.nodeKind !== 'identifier') return;
  const blockSyntax = reachingScope(graph, assignment);
  if (!blockSyntax) return;
  const later = [...graph.nodes].filter(
    ([syntax, candidate]) =>
      syntax.start >= assignment.end &&
      syntax.end <= blockSyntax.end &&
      isMatchingUse(candidate, target) &&
      !writtenTarget(graph, syntax),
  );
  for (const [syntax, use] of later) {
    const overwritten = [...graph.nodes].some(
      ([other, candidate]) =>
        other.start > assignment.end &&
        other.start < syntax.start &&
        candidate.owner === target.owner &&
        fieldExpressions(graph.index, other, 'targets').includes(target.name ?? ''),
    );
    if (!overwritten) graph.edge(use, target, 'reaching_value');
  }
}

function appendBoundaries(graph: BackendGraph, syntax: SyntaxNode, node: SemanticNode) {
  if (node.nodeKind === 'function' && node.declaredAsync === true) {
    graph.edge(
      node,
      graph.extra(node, 'runtime_boundary', 'runtime async activation unresolved', 'async'),
      'scheduling_unknown',
    );
  }
  if (node.nodeKind === 'index') {
    graph.edge(
      node,
      graph.extra(
        node,
        'runtime_boundary',
        'mutable indexed dispatch requires registry and type context',
        'registry',
      ),
      'registry_context_unknown',
    );
  }
  if (node.nodeKind === 'try') {
    graph.edge(
      node,
      graph.extra(
        node,
        'runtime_boundary',
        'rollback or compensation not established by catch topology',
        'rollback',
      ),
      'rollback_unknown',
    );
  }
  if (node.nodeKind !== 'call') return;
  const callee = fieldExpressions(graph.index, syntax, 'callee')[0] ?? '';
  if (callee.endsWith('.thenRun')) {
    for (const callback of fieldNodes(graph, syntax, 'arguments')) {
      graph.edge(node, callback, 'continuation');
    }
  }
  if (callee.endsWith('.send') || callee.endsWith('.InsertTx')) {
    graph.edge(
      node,
      graph.extra(
        node,
        'runtime_boundary',
        'call completion does not establish consumer execution or delivery',
        'delivery',
      ),
      'delivery_unknown',
    );
  }
}

/** These are source-local relations; next edges require normal statement completion. */
export function appendBackendRelations(graph: BackendGraph): void {
  appendJavaPatternBindings(graph);
  for (const [syntax, node] of graph.nodes) {
    appendOrder(graph, syntax);
    if (
      ['declaration', 'assignment'].includes(node.nodeKind) &&
      ['ASSIGNMENT', 'AssignStmt', 'VARIABLE', 'ValueSpec'].includes(syntax.kind)
    ) {
      appendAssignment(graph, syntax, node);
    }
    appendTerminal(graph, syntax, node);
    appendBoundaries(graph, syntax, node);
    appendSqlBindings(graph, syntax, node);
  }
}

function appendTerminal(graph: BackendGraph, syntax: SyntaxNode, node: SemanticNode) {
  if (node.nodeKind === 'return') {
    for (const value of fieldNodes(graph, syntax, 'values')) graph.edge(node, value, 'returns');
  }
  if (node.nodeKind === 'defer') {
    for (const value of fieldNodes(graph, syntax, 'expression')) {
      graph.edge(node, value, 'deferred');
    }
  }
}

function isMatchingUse(candidate: SemanticNode, target: SemanticNode): boolean {
  return (
    candidate.owner === target.owner &&
    candidate.nodeKind === 'identifier' &&
    candidate.name === target.name
  );
}

function reachingScope(graph: BackendGraph, assignment: SyntaxNode): SyntaxNode | undefined {
  const parent = graph.index.nodes[assignment.parent ?? -1];
  const scope =
    parent?.kind === 'EXPRESSION_STATEMENT' ? graph.index.nodes[parent.parent ?? -1] : parent;
  if (!scope) return undefined;
  if (['BLOCK', 'BlockStmt'].includes(scope.kind)) return scope;
  const initialiser =
    scope.fields?.initializer?.some(
      ([start, end]) => assignment.start >= start && assignment.end <= end,
    ) === true;
  return scope.kind === 'IfStmt' && initialiser ? scope : undefined;
}

function writtenTarget(graph: BackendGraph, syntax: SyntaxNode): boolean {
  return graph.index.nodes.some(
    (node) =>
      node.fields?.targets?.some(([start, end]) => syntax.start === start && syntax.end === end) ===
      true,
  );
}
