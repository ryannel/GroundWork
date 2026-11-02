import type { SemanticNode } from '@/domain/scan/scan.generated';

import type { DepthResult } from './scan-benchmark-depth-facts';
import {
  argumentsAre,
  inBranch,
  nativeResult,
  sameFile,
  unknownBoundary,
} from './scan-depth-native-query';
import { expressionSpelling } from './scan-semantic-expression';
import {
  includesNode,
  namedCalls,
  namedFunction,
  ownedNodes,
  targets,
  type SemanticGraph,
} from './scan-semantic-query';

export function ordinaryError(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const guard = ownedNodes(graph, owner, 'if').find((node) =>
    targets(graph, node, 'condition').some(
      (condition) => expressionSpelling(graph, condition) === '!ok',
    ),
  );
  const missing = namedCalls(graph, owner, 'errors.New')[0];
  const missingReturn = ownedNodes(graph, owner, 'return').find(
    (node) =>
      inBranch(graph, guard, node) &&
      targets(graph, node, 'returns').some((value) => value.id === missing?.id),
  );
  const found = ownedNodes(graph, owner, 'call').find((node) =>
    targets(graph, node, 'callee').some((callee) =>
      targets(graph, callee, 'property').some((property) => property.name === 'Handle'),
    ),
  );
  const callee = targets(graph, found, 'callee')[0];
  const assertion = targets(graph, callee, 'receiver')[0];
  const finalReturn = ownedNodes(graph, owner, 'return').find((node) =>
    targets(graph, node, 'returns').some((value) => value.id === found?.id),
  );
  const fn = ownedNodes(graph, owner, 'function')[0];
  return nativeResult(
    id,
    [
      [
        'missing-key ordinary error return',
        missingReturn !== undefined &&
          argumentsAre(graph, missing, ['"no handler found for command"']),
      ],
      [
        'found typed command handler',
        assertion?.nodeKind === 'expression' &&
          targets(graph, assertion, 'receiver').some((receiver) => receiver.name === 'handler') &&
          targets(graph, assertion, 'declared_type').some(
            (type) => expressionSpelling(graph, type) === 'commandHandler[C]',
          ),
      ],
      [
        'found returns Handle error',
        argumentsAre(graph, found, ['ctx', 'cmd']) &&
          finalReturn !== undefined &&
          fn?.returnType === 'error',
      ],
      [
        'error is not throw or asserted success',
        ownedNodes(graph, owner, 'throw').length === 0 && !inBranch(graph, guard, found),
      ],
    ],
    [guard, missing, missingReturn, found, assertion, finalReturn],
  );
}

export function contextualRegistry(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const lookup = ownedNodes(graph, owner, 'index').find(
    (node) => expressionSpelling(graph, targets(graph, node, 'receiver')[0]) === 'handlers',
  );
  const reflect = namedCalls(graph, owner, 'reflect.TypeOf')[0];
  const fn = namedFunction(graph, 'AddHandler');
  const mutation = ownedNodes(graph, fn?.owner, 'assignment').find((node) =>
    registryWrite(graph, node),
  );
  const keyAssignment = keyDeclaration(graph, owner);
  const addKey = keyDeclaration(graph, fn?.owner ?? '');
  const moduleHandlers = graph.nodes.find(
    (node) =>
      node.nodeKind === 'declaration' &&
      targets(graph, node, 'target').some((target) => target.name === 'handlers') &&
      node.owner !== owner &&
      node.owner !== fn?.owner,
  );
  return nativeResult(
    id,
    [
      [
        'reflect.TypeOf(k) registry selector',
        reflect !== undefined &&
          argumentsAre(graph, reflect, ['k']) &&
          includesNode(graph, lookup, reflect),
      ],
      ['key[C]{} constructed locally', keyAssignment !== undefined && addKey !== undefined],
      [
        'AddHandler writes package registry',
        mutation !== undefined &&
          moduleHandlers !== undefined &&
          sameFile(graph, ownedNodes(graph, owner, 'function')[0], fn),
      ],
      [
        'registry/type/config context unresolved',
        unknownBoundary(graph, lookup, 'registry_context_unknown'),
      ],
      [
        'no unconditional resolved target',
        !(graph.outgoing.get(lookup?.id ?? '') ?? []).some(
          (edge) => edge.relation === 'call_target',
        ),
      ],
    ],
    [lookup, reflect, fn, mutation, keyAssignment, moduleHandlers],
  );
}

function keyDeclaration(graph: SemanticGraph, owner: string) {
  return ownedNodes(graph, owner, 'assignment').find(
    (node) =>
      targets(graph, node, 'target').some((target) => target.name === 'k') &&
      targets(graph, node, 'value').some(
        (value) => expressionSpelling(graph, value) === 'key[C]{}',
      ),
  );
}

function registryWrite(graph: SemanticGraph, node: SemanticNode): boolean {
  return targets(graph, node, 'target').some(
    (target) =>
      expressionSpelling(graph, target) === 'handlers[reflect.TypeOf(k)]' &&
      targets(graph, target, 'assigned_value').some(
        (value) => value.nodeKind === 'identifier' && value.name === 'handler',
      ),
  );
}
