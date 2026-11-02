import type { DepthResult } from './scan-benchmark-depth-facts';
import { directBlockCall, directBranchReturn } from './scan-depth-error-flow';
import {
  argumentsAre,
  comesBefore,
  conditionIs,
  inBranch,
  nativeResult,
  reboundFrom,
  returned,
  unknownBoundary,
} from './scan-depth-native-query';
import { expressionSpelling } from './scan-semantic-expression';
import {
  descendants,
  includesNode,
  namedCalls,
  namedFunction,
  ownedNodes,
  targets,
  type SemanticGraph,
} from './scan-semantic-query';

function equalityBranch(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const guard = ownedNodes(graph, owner, 'if').find((node) =>
    conditionIs(graph, node, 'updatedCustomer.equals(previousCustomer)'),
  );
  const earlyReturn = ownedNodes(graph, owner, 'return').find(
    (node) =>
      directBranchReturn(graph, guard)?.id === node.id &&
      returned(graph, node).some((value) => expressionSpelling(graph, value) === 'updatedCustomer'),
  );
  const calls = [
    'customerValidatorService.validate',
    'customerRepository.save',
    'savePostProcessor.postProcess',
  ].map((name) => namedCalls(graph, owner, name)[0]);
  return nativeResult(
    id,
    [
      ['equality returns updated value', guard !== undefined && earlyReturn !== undefined],
      [
        'validate/save/post absent from equal branch',
        calls.every((call) => call !== undefined && !inBranch(graph, guard, call)),
      ],
      [
        'changed path follows early-return branch',
        calls.every((call) => comesBefore(graph, guard, call)),
      ],
    ],
    [guard, earlyReturn, ...calls],
  );
}

function rebound(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const validate = namedCalls(graph, owner, 'customerValidatorService.validate')[0];
  const save = namedCalls(graph, owner, 'customerRepository.save')[0];
  const post = namedCalls(graph, owner, 'savePostProcessor.postProcess')[0];
  const finalReturn = ownedNodes(graph, owner, 'return').find((node) =>
    returned(graph, node).some(
      (value) =>
        expressionSpelling(graph, value) === 'updatedCustomer' && reboundFrom(graph, value, save),
    ),
  );
  const postValue = targets(graph, post, 'argument')[1];
  const returnValue = returned(graph, finalReturn)[0];
  return nativeResult(
    id,
    [
      [
        'validate then save then post',
        comesBefore(graph, validate, save) && comesBefore(graph, save, post),
      ],
      [
        'validate/save input',
        argumentsAre(graph, validate, ['updatedCustomer']) &&
          argumentsAre(graph, save, ['updatedCustomer']),
      ],
      [
        'post previous/rebound actuals',
        argumentsAre(graph, post, ['previousCustomer', 'updatedCustomer']) &&
          reboundFrom(graph, postValue, save),
      ],
      [
        'returned save result',
        reboundFrom(graph, returnValue, save) && comesBefore(graph, post, finalReturn),
      ],
    ],
    [validate, save, post, finalReturn],
  );
}

function asyncActivation(graph: SemanticGraph, _owner: string, id: string): DepthResult {
  const fn = namedFunction(graph, 'postProcess');
  const calls = [
    'customerEventService.publishCustomerEvent',
    'analyticsEventService.publishAnalyticsEvent',
    'auditLogService.saveCustomerAuditLog',
    'marketingConsentEventService.publishEvent',
  ].map((callee) => namedCalls(graph, fn?.owner, callee)[0]);
  return nativeResult(
    id,
    [
      ['source @Async and void', fn?.declaredAsync === true && fn.returnType === 'void'],
      [
        'ordered event/analytics/audit/marketing',
        calls.every(
          (call, position) =>
            call !== undefined && (position === 0 || comesBefore(graph, calls[position - 1], call)),
        ),
      ],
      ['runtime activation unresolved', unknownBoundary(graph, fn, 'scheduling_unknown')],
    ],
    [fn, ...calls],
  );
}

function disabledPublication(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const branch = ownedNodes(graph, owner, 'if').find((node) =>
    conditionIs(graph, node, 'kafkaTemplate==null||!settings.enabled()'),
  );
  const completed = namedCalls(graph, owner, 'CompletableFuture.completedFuture')[0];
  const send = namedCalls(graph, owner, 'kafkaTemplate.send')[0];
  const earlyReturn = ownedNodes(graph, owner, 'return').find((node) =>
    returned(graph, node).some((value) => value.id === completed?.id),
  );
  const predicate = targets(graph, branch, 'condition')[0];
  return nativeResult(
    id,
    [
      [
        'typed OR guard',
        descendants(graph, predicate).some(
          (node) => node.nodeKind === 'binary' && node.operator === '||',
        ),
      ],
      [
        'disabled returns completedFuture(null)',
        argumentsAre(graph, completed, ['null']) &&
          inBranch(graph, branch, completed) &&
          directBranchReturn(graph, branch)?.id === earlyReturn?.id &&
          earlyReturn !== undefined,
      ],
      [
        'send only after early return branch',
        send !== undefined && !inBranch(graph, branch, send) && comesBefore(graph, branch, send),
      ],
    ],
    [branch, completed, earlyReturn, send],
  );
}

function returnedCompletion(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const fn = ownedNodes(graph, owner, 'function')[0];
  const send = namedCalls(graph, owner, 'kafkaTemplate.send')[0];
  const then = ownedNodes(graph, owner, 'call').find((call) =>
    targets(graph, call, 'callee').some((callee) =>
      targets(graph, callee, 'receiver').some((receiver) => receiver.id === send?.id),
    ),
  );
  const result = ownedNodes(graph, owner, 'return').find((node) =>
    returned(graph, node).some((value) => value.id === then?.id),
  );
  const message = namedCalls(graph, owner, 'kafkaEventPublisher.buildEventMessage')[0];
  const argument = targets(graph, send, 'argument')[0];
  return nativeResult(
    id,
    [
      [
        'returned CompletableFuture<Void>',
        fn?.returnType?.replaceAll(' ', '') === 'CompletableFuture<Void>' && result !== undefined,
      ],
      [
        'send(message) feeds thenRun',
        argumentsAre(graph, send, ['message']) &&
          expressionSpelling(graph, targets(graph, then, 'callee')[0]).endsWith('.thenRun'),
      ],
      [
        'completion callback distinct',
        targets(graph, then, 'continuation').some((node) => node.nodeKind === 'function'),
      ],
      [
        'message construction inputs',
        argumentsAre(graph, message, [
          'settings.topicName()',
          'updated.customerId()',
          'event',
          'VERSION',
          'PRODUCER_ID',
        ]) && reboundFrom(graph, argument, message),
      ],
      ['consumer delivery unresolved', unknownBoundary(graph, send, 'delivery_unknown')],
    ],
    [fn, send, then, result, message],
  );
}

function archiveNodes(graph: SemanticGraph, owner: string) {
  const attempt = ownedNodes(graph, owner, 'try')[0];
  const archive = namedCalls(graph, owner, 'customerArchiveRepository.upsertCustomerArchive')[0];
  const erase = namedCalls(graph, owner, 'customerService.deleteCustomer')[0];
  const expired = namedCalls(graph, owner, 'statistics.addExpired')[0];
  const failed = namedCalls(graph, owner, 'statistics.addFailed')[0];
  const caught = targets(graph, attempt, 'catch')[0];
  return { attempt, archive, erase, expired, failed, caught };
}

function archiveOrder(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const nodes = archiveNodes(graph, owner);
  const body = targets(graph, nodes.attempt, 'body')[0];
  const log = namedCalls(graph, owner, 'log.warn')[0];
  return nativeResult(
    id,
    [
      [
        'archive/customer deletion arguments',
        argumentsAre(graph, nodes.archive, ['customer']) &&
          argumentsAre(graph, nodes.erase, ['customer.customerId()']),
      ],
      [
        'try archive then delete then expired',
        [nodes.archive, nodes.erase, nodes.expired].every((node) =>
          includesNode(graph, body, node),
        ) &&
          comesBefore(graph, nodes.archive, nodes.erase) &&
          comesBefore(graph, nodes.erase, nodes.expired),
      ],
      [
        'catch Exception increments failed and logs',
        directBlockCall(graph, targets(graph, nodes.caught, 'body')[0], nodes.failed) &&
          directBlockCall(graph, targets(graph, nodes.caught, 'body')[0], log) &&
          targets(graph, nodes.caught, 'parameter').some((node) =>
            targets(graph, node, 'declared_type').some((type) => type.name === 'Exception'),
          ),
      ],
      [
        'catch allows return',
        !descendants(graph, nodes.caught).some(
          (node) => node.nodeKind === 'throw' || node.nodeKind === 'return',
        ) && comesBefore(graph, nodes.failed, log),
      ],
    ],
    Object.values(nodes),
  );
}

function archiveFailure(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const nodes = archiveNodes(graph, owner);
  return nativeResult(
    id,
    [
      ['upsert before deletion', comesBefore(graph, nodes.archive, nodes.erase)],
      [
        'later deletion under same try',
        targets(graph, nodes.attempt, 'body').some(
          (body) =>
            includesNode(graph, body, nodes.archive) && includesNode(graph, body, nodes.erase),
        ),
      ],
      ['failure increments failed in catch', includesNode(graph, nodes.caught, nodes.failed)],
      ['rollback/compensation unknown', unknownBoundary(graph, nodes.attempt, 'rollback_unknown')],
    ],
    Object.values(nodes),
  );
}

const CHECKS: Readonly<
  Record<string, (graph: SemanticGraph, owner: string, id: string) => DepthResult>
> = {
  'spring-equal-branch': equalityBranch,
  'spring-rebound-save-result': rebound,
  'spring-async-activation': asyncActivation,
  'spring-disabled-publication': disabledPublication,
  'spring-returned-completion': returnedCompletion,
  'spring-archive-order': archiveOrder,
  'spring-archive-failure-window': archiveFailure,
};

export function evaluateSpringDepth(
  graph: SemanticGraph,
  owner: string,
  id: string,
): DepthResult | undefined {
  return CHECKS[id]?.(graph, owner, id);
}
