import type { SemanticNode } from '@/domain/scan/scan.generated';

import {
  messageBoundary,
  messageCall,
  messageLocal,
  messageMethod,
} from './scan-message-review-graph';
import type { ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { descendants, includesNode, targets } from './scan-semantic-query';

export const ORDER_CONSUMER = 'OrderUpdateEventConsumer';

export function orderMethod(graph: ProfileGraph, name: string): SemanticNode | undefined {
  return messageMethod(graph, [ORDER_CONSUMER, name]);
}
export function orderNodes(graph: ProfileGraph, name: string): SemanticNode[] {
  return descendants(graph, orderMethod(graph, name));
}
export function orderBoundary(
  ...args: readonly [
    graph: ProfileGraph,
    origin: readonly [string, string],
    recipe: string,
    target: readonly [string, string, number?],
  ]
): boolean {
  const [graph, origin, recipe, target] = args;
  const call = messageCall(graph, messageMethod(graph, origin), recipe);
  const binding = graph.calls.find((entry) => entry.call === call?.source);
  const method = graph.bySource.get(binding?.target ?? '');
  const packageNames: Readonly<Record<string, string>> = {
    OrderUpdateEventConsumer: 'messaging.consumer',
    OrderUpdateEventDeserializer: 'messaging.consumer',
    CustomerService: 'customer',
    CustomerArchiveService: 'customerarchive',
  };
  const [file, name, arity] = target;
  const nominal = `com.volvocars.ecom.customerservice.${packageNames[file] ?? ''}.${file}#${name}(`;
  return [
    binding?.signature?.startsWith(nominal) === true,
    method?.nodeKind === 'function',
    method?.name === name,
    arity === undefined || targets(graph, method, 'parameter').length === arity,
    messageBoundary(graph, call, method),
  ].every(Boolean);
}
export function orderBranch(
  graph: ProfileGraph,
  method: string,
  condition: string,
): SemanticNode | undefined {
  return orderNodes(graph, method).find(
    (node) =>
      node.nodeKind === 'if' &&
      individualRecipe(graph, targets(graph, node, 'condition')[0]) === condition,
  );
}
export function orderExit(graph: ProfileGraph, branch: SemanticNode | undefined): boolean {
  return descendants(graph, targets(graph, branch, 'consequent')[0]).some(
    (node) => node.nodeKind === 'return' && targets(graph, node, 'returns').length === 0,
  );
}
export function orderLocal(graph: ProfileGraph, name: string): boolean {
  return messageLocal(graph, orderMethod(graph, name));
}
export function orderCaught(
  ...args: readonly [graph: ProfileGraph, method: string, type: string, recipe: string]
): boolean {
  const [graph, method, type, recipe] = args;
  return orderNodes(graph, method)
    .filter((node) => node.nodeKind === 'catch')
    .some((clause) => {
      const parameter = targets(graph, clause, 'parameter')[0];
      const body = targets(graph, clause, 'body')[0];
      const nodes = descendants(graph, body);
      const protectedCalls: Readonly<Record<string, readonly string[]>> = {
        consume: ['customerService.markForArchival(event.customerId(),archiveReason)'],
        unarchiveCustomer: [
          'customerService.getCustomer(event.customerId())',
          'customerService.saveCustomer(updatedCustomer)',
        ],
        restoreCustomerFromArchive: [
          'customerArchiveService.restoreCustomerFromArchive(event.customerId(),false)',
        ],
      };
      const attempt = orderNodes(graph, method).find(
        (node) =>
          node.nodeKind === 'try' &&
          targets(graph, node, 'catch').some((entry) => entry.id === clause.id),
      );
      return [
        (
          targets(graph, parameter, 'declared_type')[0] ??
          targets(graph, clause, 'declared_type')[0]
        )?.name === type,
        targets(graph, body, 'statement').length === 1,
        nodes.some((node) => individualRecipe(graph, node) === recipe),
        !nodes.some((node) => node.nodeKind === 'throw'),
        (protectedCalls[method] ?? []).every((recipeCall) =>
          includesNode(
            graph,
            targets(graph, attempt, 'body')[0],
            messageCall(graph, orderMethod(graph, method), recipeCall),
          ),
        ),
      ].every(Boolean);
    });
}

/** Both effects must be in distinct ordered statements of this exact method body. */
export function orderBefore(
  graph: ProfileGraph,
  owner: SemanticNode | undefined,
  nodes: readonly [SemanticNode | undefined, SemanticNode | undefined],
): boolean {
  return descendants(graph, owner).some((body) => {
    const statements = targets(graph, body, 'statement');
    const indices = nodes.map((node) =>
      statements.findIndex((statement) => includesNode(graph, statement, node)),
    );
    return indices.every((index) => index >= 0) && (indices[0] ?? -1) < (indices[1] ?? -1);
  });
}

export function orderPredicate(graph: ProfileGraph, method: string, recipe: string): boolean {
  const owner = orderMethod(graph, method);
  const statements = targets(graph, targets(graph, owner, 'body')[0], 'statement');
  return [
    orderLocal(graph, method),
    statements.length === 1,
    statements[0]?.nodeKind === 'return',
    individualRecipe(graph, targets(graph, statements[0], 'returns')[0]) === recipe,
  ].every(Boolean);
}
