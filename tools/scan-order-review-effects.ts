import type { SemanticNode } from '@/domain/scan/scan.generated';

import { messageCall, messageMethod } from './scan-message-review-graph';
import { orderBoundary } from './scan-order-review-graph';
import type { ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe, individualReferences } from './scan-profile-review-individual-atoms';
import { methodRecipe } from './scan-profile-review-method';
import { descendants, targets } from './scan-semantic-query';

function statements(graph: ProfileGraph, owner: SemanticNode | undefined): readonly SemanticNode[] {
  return targets(graph, targets(graph, owner, 'body')[0], 'statement');
}
function statementIndex(
  graph: ProfileGraph,
  owner: SemanticNode | undefined,
  recipe: string,
): number {
  return statements(graph, owner).findIndex((statement) =>
    descendants(graph, statement).some((node) => individualRecipe(graph, node) === recipe),
  );
}
function assignedSave(graph: ProfileGraph): boolean {
  const owner = messageMethod(graph, ['CustomerService', 'saveCustomer']);
  const save = messageCall(graph, owner, 'customerRepository.save(customer)');
  const returned = descendants(graph, owner).find((node) => node.nodeKind === 'return');
  const value = targets(graph, returned, 'returns')[0];
  const parameter = targets(graph, owner, 'parameter')[0];
  const reaching = targets(graph, value, 'reaching_value')[0];
  const before = statementIndex(graph, owner, 'customerValidatorService.validate(customer)');
  const after = statementIndex(graph, owner, 'customerRepository.save(customer)');
  return [
    before >= 0,
    after >= 0,
    save !== undefined,
    parameter !== undefined,
    graph.values.some(
      (entry) =>
        entry.relation === 'assignment' &&
        entry.from === save?.source &&
        entry.to === parameter?.source,
    ),
    targets(graph, reaching, 'assigned_value').some((node) => node.id === save?.id),
    before < after,
    statements(graph, owner).at(-1)?.id === returned?.id,
    after < statements(graph, owner).findIndex((node) => node.id === returned?.id),
  ].every(Boolean);
}
function restorationValue(graph: ProfileGraph): boolean {
  const owner = messageMethod(graph, ['CustomerArchiveService', 'restoreCustomerFromArchive', 2]);
  if (!owner || !individualReferences(graph, owner)) return false;
  const nodes = descendants(graph, owner);
  const archival = nodes.find(
    (node) =>
      node.nodeKind === 'call' &&
      targets(graph, node, 'callee')[0]?.name === 'archivalData' &&
      targets(graph, node, 'argument').length === 1,
  );
  const conditional = targets(graph, archival, 'argument')[0];
  const predicate = targets(graph, conditional, 'condition')[0];
  const parameter = targets(graph, owner, 'parameter')[1];
  const customer = nodes.find(
    (node) => node.nodeKind === 'declaration' && node.name === 'customer',
  );
  const initializer = targets(graph, customer, 'value')[0];
  const builder = targets(graph, targets(graph, initializer, 'callee')[0], 'receiver')[0];
  const save = messageCall(graph, owner, 'customerService.saveCustomer(customer)');
  const actual = targets(graph, save, 'argument')[0];
  return [
    builder?.id === archival?.id,
    individualRecipe(
      graph,
      targets(graph, targets(graph, archival, 'callee')[0], 'receiver')[0],
    ) === 'oldCustomer.toBuilder().version(null)',
    graph.values.some(
      (entry) =>
        entry.relation === 'reference' &&
        entry.from === customer?.source &&
        entry.to === actual?.source,
    ),
    targets(graph, targets(graph, actual, 'reaching_value')[0], 'assigned_value').some(
      (node) => node.id === initializer?.id,
    ),
    conditional?.nodeKind === 'conditional',
    individualRecipe(graph, predicate) === 'markForArchival',
    graph.values.some(
      (entry) =>
        entry.relation === 'reference' &&
        entry.from === parameter?.source &&
        entry.to === predicate?.source,
    ),
    targets(graph, conditional, 'otherwise')[0]?.nodeKind === 'literal',
    targets(graph, conditional, 'otherwise')[0]?.value === null,
    nodes.some((node) => individualRecipe(graph, node) === 'oldCustomer.toBuilder().version(null)'),
  ].every(Boolean);
}
function restorationOrder(graph: ProfileGraph): boolean {
  const owner = messageMethod(graph, ['CustomerArchiveService', 'restoreCustomerFromArchive', 2]);
  const save = 'customerService.saveCustomer(customer)';
  const remove = 'customerArchiveRepository.delete(archive)';
  const indexes = [save, remove, 'savedCustomer'].map((recipe) =>
    statementIndex(graph, owner, recipe),
  );
  const ordered = statements(graph, owner);
  const returned = ordered.at(-1);
  return [
    returned?.nodeKind === 'return',
    individualRecipe(graph, targets(graph, returned, 'returns')[0]) === 'savedCustomer',
    (indexes[1] ?? -1) < ordered.length - 1,
    indexes.every((index) => index >= 0),
    (indexes[0] ?? -1) < (indexes[1] ?? -1),
    orderBoundary(graph, ['CustomerArchiveService', 'restoreCustomerFromArchive'], save, [
      'CustomerService',
      'saveCustomer',
    ]),
    methodRecipe(graph, ['CustomerArchiveService', 'restoreCustomerFromArchive', 2], {
      initializers: { savedCustomer: save },
      calls: [remove],
      returns: ['savedCustomer'],
    }),
    !descendants(graph, owner).some((node) => node.nodeKind === 'catch'),
  ].every(Boolean);
}

export function orderEffects(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    assignedSave: assignedSave(graph),
    restorationValue: restorationValue(graph),
    restorationOrder: restorationOrder(graph),
  };
}

export function orderValueApplied(
  graph: ProfileGraph,
  entry: {
    readonly owner: SemanticNode | undefined;
    readonly name: string;
    readonly call: string;
    readonly position?: number;
  },
): boolean {
  const declaration = descendants(graph, entry.owner).find(
    (node) => node.nodeKind === 'declaration' && node.name === entry.name,
  );
  const value = targets(graph, declaration, 'value')[0];
  const call = messageCall(graph, entry.owner, entry.call);
  const actual = targets(graph, call, 'argument')[entry.position ?? 0];
  const reaching = targets(graph, actual, 'reaching_value')[0];
  return [
    declaration !== undefined,
    value !== undefined,
    call !== undefined,
    graph.values.some(
      (binding) =>
        binding.relation === 'initializer' &&
        binding.from === value?.source &&
        binding.to === declaration?.source,
    ),
    graph.values.some(
      (binding) =>
        binding.relation === 'reference' &&
        binding.from === declaration?.source &&
        binding.to === actual?.source,
    ),
    targets(graph, reaching, 'assigned_value').some((node) => node.id === value?.id),
  ].every(Boolean);
}
