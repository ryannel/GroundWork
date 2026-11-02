import type { SemanticNode } from '@/domain/scan/scan.generated';

import type { DepthResult } from './scan-benchmark-depth-facts';
import { expressionSpelling } from './scan-semantic-expression';
import {
  descendants,
  fieldValue,
  includesNode,
  namedCalls,
  objectField,
  ownedNodes,
  targets,
  type SemanticGraph,
} from './scan-semantic-query';

export function resolve(
  graph: SemanticGraph,
  node: SemanticNode | undefined,
): SemanticNode | undefined {
  if (!node) return undefined;
  const definition =
    targets(graph, node, 'reaching_definition')[0] ?? targets(graph, node, 'binds')[0];
  if (definition) return fieldValue(graph, definition) ?? definition;
  return fieldValue(graph, node) ?? node;
}

export function propertyValue(
  graph: SemanticGraph,
  node: SemanticNode | undefined,
  name: string,
): SemanticNode | undefined {
  return fieldValue(graph, objectField(graph, resolve(graph, node), name));
}

export function args(graph: SemanticGraph, node: SemanticNode | undefined): SemanticNode[] {
  return targets(graph, node, 'argument');
}

export function hasCall(
  ...input: readonly [SemanticGraph, string | undefined, string, (readonly string[])?]
): SemanticNode | undefined {
  const [graph, owner, callee, actuals = []] = input;
  return namedCalls(graph, owner, callee).find(
    (call) =>
      actuals.length === 0 ||
      args(graph, call)
        .map((node) => expressionSpelling(graph, node))
        .join('|') === actuals.join('|'),
  );
}

export function guarded(
  graph: SemanticGraph,
  owner: string | undefined,
  condition: string,
): SemanticNode | undefined {
  return ownedNodes(graph, owner, 'if').find((branch) =>
    targets(graph, branch, 'condition').some(
      (node) => expressionSpelling(graph, node) === condition,
    ),
  );
}

export function inRole(
  ...input: readonly [
    SemanticGraph,
    SemanticNode | undefined,
    'consequent' | 'otherwise' | 'catch' | 'finally',
    SemanticNode | undefined,
  ]
): boolean {
  const [graph, parent, role, child] = input;
  return targets(graph, parent, role).some((node) => includesNode(graph, node, child));
}

export function awaited(graph: SemanticGraph, call: SemanticNode | undefined): boolean {
  return (
    call !== undefined &&
    graph.edges.some((edge) => edge.relation === 'awaited' && edge.to === call.id)
  );
}

export function before(
  graph: SemanticGraph,
  first: SemanticNode | undefined,
  second: SemanticNode | undefined,
): boolean {
  if (!first || !second) return false;
  return graph.nodes.some((block) => {
    const statements = targets(graph, block, 'statement');
    const left = statements.findIndex((node) => includesNode(graph, node, first));
    const right = statements.findIndex((node) => includesNode(graph, node, second));
    return left !== -1 && right > left;
  });
}

export function jsxAttribute(
  ...input: readonly [SemanticGraph, string | undefined, string, string]
): SemanticNode | undefined {
  const [graph, owner, name, value] = input;
  return ownedNodes(graph, owner, 'jsx_attribute').find(
    (node) => node.name === name && expressionSpelling(graph, fieldValue(graph, node)) === value,
  );
}

export function nextResult(
  id: string,
  checks: Readonly<Record<string, boolean>>,
  evidence: readonly (SemanticNode | undefined)[],
): DepthResult {
  const missing = Object.entries(checks)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  return {
    id,
    status: missing.length === 0 ? 'supported' : 'unresolved',
    reason:
      missing.length === 0
        ? 'All asserted clauses are established by source semantic relations.'
        : `Missing structured proof: ${missing.join(', ')}.`,
    evidence: evidence.flatMap((node) => (node ? [node.id] : [])),
  };
}

export function nodeOwner(node: SemanticNode | undefined): string | undefined {
  return node?.owner;
}

export function nativeButton(
  graph: SemanticGraph,
  attribute: SemanticNode | undefined,
): SemanticNode | undefined {
  return graph.nodes.find(
    (node) =>
      node.nodeKind === 'jsx_element' &&
      node.name === 'button' &&
      targets(graph, node, 'property').some((property) =>
        descendants(graph, property).some((child) => child.id === attribute?.id),
      ),
  );
}

export function propertyElement(
  graph: SemanticGraph,
  attribute: SemanticNode | undefined,
  name: string,
): boolean {
  return graph.nodes.some(
    (node) =>
      node.nodeKind === 'jsx_element' &&
      node.name === name &&
      targets(graph, node, 'property').some((property) =>
        descendants(graph, property).some((child) => child.id === attribute?.id),
      ),
  );
}

export function boundIdentifier(
  graph: SemanticGraph,
  expression: SemanticNode | undefined,
  name: string,
): boolean {
  return descendants(graph, expression).some(
    (node) =>
      node.nodeKind === 'identifier' &&
      node.name === name &&
      targets(graph, node, 'binds').length > 0,
  );
}

export function boundCallback(
  graph: SemanticGraph,
  attribute: SemanticNode | undefined,
  expected: SemanticNode | undefined,
): boolean {
  if (!expected) return false;
  return descendants(graph, attribute)
    .filter((node) => node.nodeKind === 'identifier' && node.name === expected.name)
    .some((reference) =>
      targets(graph, reference, 'binds').some(
        (definition) =>
          definition.id === expected.id ||
          [
            ...targets(graph, definition, 'initializer'),
            ...targets(graph, definition, 'callback'),
          ].some((value) => value.id === expected.id),
      ),
    );
}

export function derivedFromJson(
  ...input: readonly [SemanticGraph, SemanticNode | undefined, SemanticNode | undefined, string]
): boolean {
  const [graph, expression, json, name] = input;
  if (!json) return false;
  return descendants(graph, expression)
    .filter((node) => node.nodeKind === 'identifier' && node.name === name)
    .some((reference) => {
      const reaching = targets(graph, reference, 'reaching_definition');
      const definitions = reaching.length > 0 ? reaching : targets(graph, reference, 'binds');
      return definitions.some((definition) => jsonInitialiser(graph, definition, json));
    });
}

function jsonInitialiser(
  graph: SemanticGraph,
  definition: SemanticNode,
  json: SemanticNode,
): boolean {
  return graph.nodes.some(
    (declaration) =>
      declaration.nodeKind === 'declaration' &&
      includesNode(graph, declaration, definition) &&
      targets(graph, fieldValue(graph, declaration), 'awaited').some((task) => task.id === json.id),
  );
}

export function terminal(
  graph: SemanticGraph,
  node: SemanticNode | undefined,
): SemanticNode | undefined {
  if (node?.nodeKind === 'return' || node?.nodeKind === 'throw') return node;
  if (node?.nodeKind !== 'block') return undefined;
  return terminal(graph, targets(graph, node, 'statement').at(-1));
}
