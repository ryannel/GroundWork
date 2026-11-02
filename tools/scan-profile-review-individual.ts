import type { ScanDocument, SemanticNode } from '@/domain/scan/scan.generated';

import {
  profileGraph,
  profileInput,
  profileMethod,
  profileReference,
  type ProfileGraph,
} from './scan-profile-review-graph';
import {
  individualNodes,
  individualRecipe,
  individualReturn,
  individualReferences,
} from './scan-profile-review-individual-atoms';
import { profileIndividualFields } from './scan-profile-review-individual-fields';
import { descendants, targets } from './scan-semantic-query';

const EMPTY = 'Optional.empty()';

function identityPattern(graph: ProfileGraph, condition: SemanticNode | undefined, kind: string) {
  const operands = targets(graph, condition, 'operand');
  const pattern = operands.find((node) => targets(graph, node, 'declared_type').length > 0);
  const type = targets(graph, pattern, 'declared_type')[0];
  const declaration = targets(graph, targets(graph, pattern, 'operand')[0], 'binds')[0];
  return operands.some((node) => node.nodeKind === 'identifier' && node.name === 'userIdentity') &&
    type?.name === kind &&
    targets(graph, type, 'receiver')[0]?.name === 'UserIdentity'
    ? declaration
    : undefined;
}

function identityGetter(graph: ProfileGraph, method: string, kind: string): boolean {
  const owner = profileMethod(graph, 'FactoryContext', method)[0];
  if (!owner) return false;
  return individualNodes(graph, owner).some((node) => {
    if (node.nodeKind !== 'conditional') return false;
    const declaration = identityPattern(graph, targets(graph, node, 'condition')[0], kind);
    const consequent = targets(graph, node, 'consequent')[0];
    const use = targets(graph, consequent, 'argument')[0];
    if (!declaration || !use) return false;
    return [
      targets(graph, use, 'reaching_definition').some((target) => target.id === declaration.id),
      individualRecipe(graph, consequent) === `Optional.of(${declaration.name ?? ''})`,
      individualRecipe(graph, targets(graph, node, 'otherwise')[0]) === EMPTY,
      individualReturn(graph, owner, individualRecipe(graph, node)),
    ].every(Boolean);
  });
}

function callbackCall(graph: ProfileGraph, invocation: SemanticNode | undefined, recipe: string) {
  const callbacks = targets(graph, invocation, 'callback');
  const candidates = callbacks.length === 1 ? descendants(graph, callbacks[0]) : [];
  return candidates.find(
    (node) => node.nodeKind === 'call' && individualRecipe(graph, node) === recipe,
  );
}

function volvoFuture(graph: ProfileGraph): boolean {
  const factoryConstructor = profileMethod(graph, 'FactoryContext', '<init>').find(
    (owner) => targets(graph, owner, 'parameter').length === 4,
  );
  if (!factoryConstructor) return false;
  return individualNodes(graph, factoryConstructor).some((node) => {
    if (node.nodeKind !== 'assignment') return false;
    const target = targets(graph, node, 'target')[0];
    if (individualRecipe(graph, target) !== 'this.volvoIdUserFuture') return false;
    const conditional = targets(graph, node, 'value')[0];
    const declaration = identityPattern(
      graph,
      targets(graph, conditional, 'condition')[0],
      'VolvoId',
    );
    const supply = targets(graph, conditional, 'consequent')[0];
    const apply = callbackCall(graph, supply, 'volvoIdUserLoader.apply(token)');
    const token = apply ? targets(graph, apply, 'argument')[0] : undefined;
    const loader = targets(graph, targets(graph, apply, 'callee')[0], 'receiver')[0];
    if (!declaration || !token) return false;
    return [
      targets(graph, token, 'captures').some((binding) => binding.id === declaration.id),
      loader !== undefined && profileInput(graph, factoryConstructor, loader.source),
      individualRecipe(graph, targets(graph, supply, 'callee')[0]) ===
        'ContextAwareCompletableFuture.supplyAsyncWithContext',
      individualRecipe(graph, targets(graph, conditional, 'otherwise')[0]) ===
        'CompletableFuture.completedFuture(Optional.empty())',
    ].every(Boolean);
  });
}

function joinedOrEmpty(graph: ProfileGraph, method: string, joined: string): boolean {
  const owner = profileMethod(graph, 'FactoryContext', method)[0];
  if (!owner) return false;
  return individualNodes(graph, owner).some((node) => {
    if (node.nodeKind !== 'try') return false;
    const body = targets(graph, node, 'body')[0];
    const catches = targets(graph, node, 'catch');
    return (
      individualReturn(graph, body ?? node, joined) &&
      catches.some((caught) => {
        const parameter = targets(graph, caught, 'parameter')[0];
        return (
          targets(graph, parameter, 'declared_type')[0]?.name === 'Exception' &&
          individualReturn(graph, caught, EMPTY)
        );
      })
    );
  });
}

function blankCdbGuard(graph: ProfileGraph): boolean {
  const owner = profileMethod(graph, 'FactoryContext', 'getCdbConsumer')[0];
  if (!owner) return false;
  return individualNodes(graph, owner).some(
    (node) =>
      node.nodeKind === 'if' &&
      individualRecipe(graph, targets(graph, node, 'condition')[0]) ===
        '!StringUtils.hasText(cdbId)' &&
      individualReturn(graph, targets(graph, node, 'consequent')[0] ?? node, EMPTY),
  );
}

function cdbCache(graph: ProfileGraph): boolean {
  const owner = profileMethod(graph, 'FactoryContext', 'cdbConsumerFuture')[0];
  if (!owner) return false;
  return individualNodes(graph, owner).some((node) => {
    const callee = targets(graph, node, 'callee')[0];
    if (callee?.name !== 'computeIfAbsent') return false;
    const key = targets(graph, node, 'argument')[0];
    const callback = targets(graph, node, 'callback')[0];
    const parameter = targets(graph, callback, 'parameter')[0];
    const supply = descendants(graph, callback).find(
      (candidate) =>
        individualRecipe(graph, targets(graph, candidate, 'callee')[0]) ===
        'ContextAwareCompletableFuture.supplyAsyncWithContext',
    );
    const apply = callbackCall(graph, supply, 'cdbConsumerLoader.apply(id)');
    const use = apply ? targets(graph, apply, 'argument')[0] : undefined;
    if (!key || !parameter || !use) return false;
    return [
      profileInput(graph, owner, key.source),
      individualRecipe(graph, targets(graph, callee, 'receiver')[0]) === 'cdbConsumerFutures',
      profileReference(graph, parameter.source, use.source),
      graph.calls.some(
        (call) =>
          call.call === node.source && call.receiverType?.startsWith('java.util.Map<') === true,
      ),
      individualReturn(graph, owner, individualRecipe(graph, node)),
    ].every(Boolean);
  });
}

function fallbackHelper(graph: ProfileGraph, owner: SemanticNode, empty: string): boolean {
  const loop = individualNodes(graph, owner).find((node) => node.nodeKind === 'loop');
  const children = targets(graph, loop, 'ast_child');
  const value = children.find((node) => node.nodeKind === 'declaration');
  const values = children.find((node) => node.nodeKind === 'identifier');
  const body = children.find((node) => node.nodeKind === 'block');
  const parameter = targets(graph, owner, 'parameter')[0];
  const condition = descendants(graph, body).find((node) => node.nodeKind === 'if');
  const expected = empty === 'null' ? 'value!=null' : 'value!=null&&!value.isEmpty()';
  const terminal = targets(graph, loop, 'next')[0];
  if (!value || !values || !parameter || !terminal) return false;
  const loopInput = value.nodeKind === 'declaration' && value.name === 'value';
  return [
    children.length === 3,
    individualReferences(graph, owner),
    loopInput,
    profileReference(graph, parameter.source, values.source),
    individualRecipe(graph, targets(graph, condition, 'condition')[0]) === expected,
    individualReturn(graph, targets(graph, condition, 'consequent')[0] ?? owner, 'value'),
    individualReturn(graph, terminal, empty),
  ].every(Boolean);
}

function fallbackDeclarations(graph: ProfileGraph): boolean {
  const nullable = profileMethod(graph, 'EntityFactory', 'nullable');
  const collections = profileMethod(graph, 'EntityFactory', 'nullableOrEmpty');
  return (
    nullable.length === 1 &&
    nullable.every((owner) => fallbackHelper(graph, owner, 'null')) &&
    collections.length === 2 &&
    collections.every((owner) => {
      const parameter = targets(graph, owner, 'parameter')[0];
      const type = targets(graph, parameter, 'declared_type')[0]?.name;
      const empty = type === 'List<V>...' ? 'List.of()' : 'Set.of()';
      return (
        ['List<V>...', 'Set<V>...'].includes(type ?? '') && fallbackHelper(graph, owner, empty)
      );
    })
  );
}

/** Identity and merge source construction; library/callback scheduling stays unobserved. */
export function profileIndividualComposition(
  document: ScanDocument,
): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  const clauses = {
    connectIdentity: identityGetter(graph, 'getConnectToken', 'Connect'),
    entraIdentity: identityGetter(graph, 'getEntraIdUser', 'EntraId'),
    volvoIdentityFuture: volvoFuture(graph),
    volvoFutureJoin: joinedOrEmpty(graph, 'getVolvoIdUser', 'volvoIdUserFuture.join()'),
    blankCdbSkipped: blankCdbGuard(graph),
    cdbFutureJoin: joinedOrEmpty(graph, 'getCdbConsumer', 'cdbConsumerFuture(cdbId).join()'),
    cdbCacheById: cdbCache(graph),
    fallbackHelperDeclarations: fallbackDeclarations(graph),
    ...profileIndividualFields(graph),
  };
  return { ...clauses, supported: Object.values(clauses).every(Boolean) };
}
