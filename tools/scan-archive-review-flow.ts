import type { SemanticNode } from '@/domain/scan/scan.generated';

import {
  messageBoundary,
  messageCall,
  messageLocal,
  messageMethod,
} from './scan-message-review-graph';
import type { ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { descendants, targets } from './scan-semantic-query';

function statements(graph: ProfileGraph, node: SemanticNode | undefined): SemanticNode[] {
  return targets(graph, targets(graph, node, 'body')[0], 'statement');
}
function recipes(graph: ProfileGraph, nodes: readonly SemanticNode[]): string[] {
  return nodes.map((node) => individualRecipe(graph, node));
}
function exceptionCatch(
  graph: ProfileGraph,
  attempt: SemanticNode | undefined,
): SemanticNode | undefined {
  const catches = targets(graph, attempt, 'catch');
  const selected = catches[0];
  const parameter = targets(graph, selected, 'parameter')[0];
  return catches.length === 1 && targets(graph, parameter, 'declared_type')[0]?.name === 'Exception'
    ? selected
    : undefined;
}
function customerFailure(graph: ProfileGraph): boolean {
  const owner = messageMethod(graph, [
    'CustomerArchiveService',
    'moveCustomerToArchivedCollection',
    2,
  ]);
  const body = statements(graph, owner);
  const attempt = body[0];
  const successful = statements(graph, attempt);
  const caught = exceptionCatch(graph, attempt);
  const failed = statements(graph, caught);
  const success = recipes(graph, successful);
  const failure = recipes(graph, failed);
  return [
    messageLocal(graph, owner),
    body.length === 1,
    attempt?.nodeKind === 'try',
    success.length === 4,
    success[0] === 'customerArchiveRepository.upsertCustomerArchive(customer)',
    success[1] === 'customerService.deleteCustomer(customer.customerId())',
    success[2] === 'statistics.addExpired()',
    success[3]?.startsWith('log.info('),
    failure.length === 2,
    failure[0] === 'statistics.addFailed()',
    failure[1]?.startsWith('log.warn('),
    ['addExpired', 'addFailed'].every((method) =>
      messageBoundary(
        graph,
        messageCall(graph, owner, `statistics.${method}()`),
        messageMethod(graph, ['CustomerArchiveJobStatistics', method, 0]),
      ),
    ),
    descendants(graph, caught).every((node) => !['throw', 'return'].includes(node.nodeKind)),
  ].every(Boolean);
}
function iteration(graph: ProfileGraph): boolean {
  const owner = messageMethod(graph, ['CustomerArchiveService', 'findAndArchiveCustomers', 1]);
  const target = messageMethod(graph, [
    'CustomerArchiveService',
    'moveCustomerToArchivedCollection',
    2,
  ]);
  const calls = descendants(graph, owner).filter((node) => node.nodeKind === 'call');
  const loop = calls.find((node) => targets(graph, node, 'callee')[0]?.name === 'forEach');
  const callee = targets(graph, loop, 'callee')[0];
  const receiver = targets(graph, callee, 'receiver')[0];
  const callback = targets(graph, loop, 'callback')[0];
  const invoke = messageCall(
    graph,
    callback,
    'moveCustomerToArchivedCollection(customer,statistics)',
  );
  const executable = targets(graph, callback, 'ast_child').filter(
    (node) => node.nodeKind !== 'parameter',
  );
  return [
    messageLocal(graph, owner),
    statements(graph, owner).length === 1,
    executable.length === 1 && executable[0]?.id === invoke?.id,
    individualRecipe(graph, receiver) === 'customerService.getCustomersReadyForArchival()',
    targets(graph, callback, 'parameter')[0]?.name === 'customer',
    invoke !== undefined,
    messageBoundary(graph, invoke, target),
    graph.values.some(
      (value) =>
        value.relation === 'reference' &&
        value.from === targets(graph, owner, 'parameter')[0]?.source &&
        value.to === targets(graph, invoke, 'argument')[1]?.source,
    ),
    graph.values.some(
      (value) =>
        value.relation === 'reference' &&
        value.from === targets(graph, callback, 'parameter')[0]?.source &&
        value.to === targets(graph, invoke, 'argument')[0]?.source,
    ),
  ].every(Boolean);
}
function jobFailure(graph: ProfileGraph): boolean {
  const job = messageMethod(graph, ['CustomerArchiveJob', 'start', 0]);
  const service = messageMethod(graph, ['CustomerArchiveService', 'findAndArchiveCustomers', 1]);
  const body = statements(graph, job);
  const attempt = body[1];
  const successful = statements(graph, attempt);
  const caught = exceptionCatch(graph, attempt);
  const failed = statements(graph, caught);
  const call = messageCall(
    graph,
    attempt,
    'customerArchiveService.findAndArchiveCustomers(statistics)',
  );
  return [
    messageLocal(graph, job),
    body.length === 2,
    attempt?.nodeKind === 'try',
    successful.length === 3,
    individualRecipe(graph, targets(graph, successful[0], 'value')[0]) ===
      'CustomerArchiveJobStatistics()',
    messageBoundary(graph, call, service),
    individualRecipe(graph, successful[2]).startsWith('log.info('),
    descendants(graph, successful[2]).some(
      (node) => individualRecipe(graph, node) === 'statistics.getNumberOfArchived()',
    ),
    descendants(graph, successful[2]).some(
      (node) => individualRecipe(graph, node) === 'statistics.getNumberOfFailed()',
    ),
    failed.length === 1,
    individualRecipe(graph, failed[0]).startsWith('log.error('),
  ].every(Boolean);
}

export function archiveFlowClauses(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    perCustomerCatchAndOrder: customerFailure(graph),
    iterationCustomerStatisticsLineage: iteration(graph),
    outerJobFailureAndStatistics: jobFailure(graph),
  };
}

/** Counters require the exact integer field reference and a single increment statement. */
export function archiveCounterIncrements(graph: ProfileGraph): boolean {
  const schema = graph.document.framework?.find(
    (entry) =>
      entry.kind === 'schema_binding' && entry.typeName.endsWith('.CustomerArchiveJobStatistics'),
  );
  if (schema?.kind !== 'schema_binding') return false;
  return [
    ['addFailed', 'numberOfFailed'],
    ['addExpired', 'numberOfArchived'],
  ].every(([method = '', field]) => {
    const owner = messageMethod(graph, ['CustomerArchiveJobStatistics', method, 0]);
    const body = statements(graph, owner);
    const increment = targets(graph, body[0], 'value')[0];
    const operand = targets(graph, increment, 'operand')[0];
    const property = schema.properties.find(
      (entry) => entry.name === field && entry.type === 'int',
    );
    return [
      body.length === 1,
      increment?.nodeKind === 'unary',
      increment?.operator === '++',
      operand?.nodeKind === 'identifier',
      operand?.name === field,
      property !== undefined,
      graph.values.some(
        (entry) =>
          entry.relation === 'reference' &&
          entry.from === property?.source &&
          entry.to === operand?.source,
      ),
    ].every(Boolean);
  });
}
