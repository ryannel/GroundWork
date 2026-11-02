import { messageCall, messageMethod } from './scan-message-review-graph';
import { orderValueApplied } from './scan-order-review-effects';
import type { ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { methodRecipe } from './scan-profile-review-method';
import { descendants, targets } from './scan-semantic-query';

export function orderRestoreLookup(graph: ProfileGraph): boolean {
  const owner = messageMethod(graph, ['CustomerArchiveService', 'restoreCustomerFromArchive', 2]);
  const nodes = descendants(graph, owner);
  const lookup = nodes.find(
    (node) => node.nodeKind === 'call' && targets(graph, node, 'callee')[0]?.name === 'orElseThrow',
  );
  const receiver = targets(graph, targets(graph, lookup, 'callee')[0], 'receiver')[0];
  const callback = targets(graph, lookup, 'callback')[0];
  const exception = descendants(graph, callback).find((node) => node.nodeKind === 'construct');
  const parameter = targets(graph, owner, 'parameter')[0];
  const input = targets(
    graph,
    messageCall(graph, owner, 'customerArchiveRepository.findByCustomerId(archivedCustomerId)'),
    'argument',
  )[0];
  return [
    individualRecipe(graph, receiver) ===
      'customerArchiveRepository.findByCustomerId(archivedCustomerId)',
    individualRecipe(graph, exception) ===
      'CustomerNotFoundException("Archived customer not found with id: "+archivedCustomerId)',
    graph.values.some(
      (value) =>
        value.relation === 'reference' &&
        value.from === parameter?.source &&
        value.to === input?.source,
    ),
    methodRecipe(graph, ['CustomerArchiveService', 'restoreCustomerFromArchive', 2], {
      initializers: {
        oldCustomer: 'archive.customer()',
        oldArchivalData: 'Optional.ofNullable(oldCustomer.archivalData())',
      },
    }),
    orderValueApplied(graph, {
      owner,
      name: 'customer',
      call: 'customerService.saveCustomer(customer)',
    }),
  ].every(Boolean);
}

export function orderLiveLookup(graph: ProfileGraph): boolean {
  const consumer = messageMethod(graph, ['OrderUpdateEventConsumer', 'unarchiveCustomer']);
  const call = messageCall(graph, consumer, 'customerService.getCustomer(event.customerId())');
  const binding = graph.calls.find((entry) => entry.call === call?.source);
  const owner = graph.bySource.get(binding?.target ?? '');
  const statements = targets(graph, targets(graph, owner, 'body')[0], 'statement');
  const lookup = targets(graph, statements[1], 'returns')[0];
  const receiver = targets(graph, targets(graph, lookup, 'callee')[0], 'receiver')[0];
  const callback = targets(graph, lookup, 'callback')[0];
  const exception = descendants(graph, callback).find((node) => node.nodeKind === 'construct');
  const parameter = targets(graph, owner, 'parameter')[0];
  const actual = targets(graph, exception, 'argument')[0];
  return [
    owner?.name === 'getCustomer',
    statements.length === 2,
    statements[1]?.nodeKind === 'return',
    targets(graph, lookup, 'callee')[0]?.name === 'orElseThrow',
    individualRecipe(graph, receiver) === 'customerRepository.findByCustomerId(customerId)',
    individualRecipe(graph, exception) === 'CustomerNotFoundException(customerId)',
    graph.values.some(
      (value) =>
        value.relation === 'reference' &&
        value.from === parameter?.source &&
        value.to === actual?.source,
    ),
  ].every(Boolean);
}
