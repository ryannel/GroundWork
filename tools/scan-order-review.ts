import type { ScanDocument } from '@/domain/scan/scan.generated';

import type { EventQuestionProof } from './scan-event-review';
import { messageCall, messageMethod } from './scan-message-review-graph';
import { filterConstants, statusList } from './scan-order-review-constants';
import { orderEffects, orderValueApplied } from './scan-order-review-effects';
import {
  ORDER_CONSUMER,
  orderBefore,
  orderBoundary,
  orderBranch,
  orderCaught,
  orderExit,
  orderLocal,
  orderMethod,
  orderPredicate,
} from './scan-order-review-graph';
import {
  orderCatchOrder,
  orderDecodeContract,
  orderPayloadProjections,
} from './scan-order-review-payload';
import { orderLiveLookup, orderRestoreLookup } from './scan-order-review-restore';
import { profileGraph, profileScalar, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { methodRecipe } from './scan-profile-review-method';
import { descendants, includesNode, targets } from './scan-semantic-query';

const SAVE_POST = 'saveAndPostProcess(originalCustomer,customer)';
const SAVE_LIVE = 'customerService.saveCustomer(updatedCustomer)';

const MARK = 'customerService.markForArchival(event.customerId(),archiveReason)';
const DECODE = 'orderUpdateEventDeserializer.deserialize(eventJson)';
const UPDATE = 'isCustomerUpdateEvent(event)';
const UNARCHIVE = 'unarchiveCustomer(event)';

function priority(graph: ProfileGraph): boolean {
  const body = targets(graph, orderMethod(graph, 'consume'), 'body')[0];
  const statements = targets(graph, body, 'statement');
  const update = orderBranch(graph, 'consume', UPDATE);
  const valid = orderBranch(graph, 'consume', 'isValidOrderEvent(event)');
  const unarchiveCall = messageCall(graph, orderMethod(graph, 'consume'), UNARCHIVE);
  const mark = messageCall(graph, orderMethod(graph, 'consume'), MARK);
  const updateStatements = targets(graph, targets(graph, update, 'consequent')[0], 'statement');
  return [
    orderLocal(graph, 'consume'),
    update !== undefined,
    valid !== undefined,
    statements.some((node) => node.id === update?.id) &&
      statements.findIndex((node) => node.id === update?.id) <
        statements.findIndex((node) => node.id === valid?.id),
    orderExit(graph, update),
    updateStatements.length === 2,
    individualRecipe(graph, updateStatements[0]) === UNARCHIVE,
    updateStatements[1]?.nodeKind === 'return',
    targets(graph, updateStatements[1], 'returns').length === 0,
    includesNode(graph, targets(graph, update, 'consequent')[0], unarchiveCall),
    includesNode(graph, targets(graph, valid, 'consequent')[0], mark),
    orderCaught(
      graph,
      'consume',
      'CustomerServiceException',
      'log.warn("Failed to mark customer for deletion. OrderId: {}, CustomerId: {}, Error: {}",event.orderId(),event.customerId(),e.getMessage())',
    ),
  ].every(Boolean);
}
function reasons(graph: ProfileGraph): boolean {
  const method = orderMethod(graph, 'determineArchiveReason');
  const statements = targets(graph, targets(graph, method, 'body')[0], 'statement');
  const returned = statements[0];
  const choice = targets(graph, returned, 'returns')[0];
  const cases = targets(graph, choice, 'consequent');
  const expected = [
    ['COMPLETED', 'ArchiveReason.ORDER_COMPLETED'],
    ['CANCELLED', 'ArchiveReason.ORDER_CANCELLED'],
    ['ABANDONED', 'ArchiveReason.ABANDONED'],
  ];
  return [
    orderLocal(graph, 'determineArchiveReason'),
    statements.length === 1,
    returned?.nodeKind === 'return',
    choice?.nodeKind === 'control',
    individualRecipe(graph, targets(graph, choice, 'condition')[0]) === 'payload.orderStatus()',
    cases.length === 4,
    expected.every(([status, reason], position) => {
      const arm = cases[position];
      const label = targets(graph, arm, 'condition')[0];
      const reference = targets(graph, label, 'value')[0] ?? label;
      return (
        profileScalar(graph, reference?.source ?? '') === status &&
        individualRecipe(graph, targets(graph, arm, 'value')[0]) === reason
      );
    }),
    descendants(graph, cases[3]).some(
      (node) =>
        node.nodeKind === 'throw' &&
        individualRecipe(graph, targets(graph, node, 'value')[0]) ===
          'IllegalArgumentException("Invalid order status: "+payload.orderStatus())',
    ),
  ].every(Boolean);
}
function unarchive(graph: ProfileGraph): boolean {
  const guard = orderBranch(graph, 'unarchiveCustomer', 'originalCustomer.archivalData()==null');
  return [
    orderLocal(graph, 'unarchiveCustomer'),
    orderLocal(graph, 'restoreCustomerFromArchive'),
    orderValueApplied(graph, {
      owner: orderMethod(graph, 'unarchiveCustomer'),
      name: 'updatedCustomer',
      call: SAVE_LIVE,
    }),
    orderExit(graph, guard),
    orderBefore(graph, orderMethod(graph, 'unarchiveCustomer'), [
      guard,
      messageCall(graph, orderMethod(graph, 'unarchiveCustomer'), SAVE_LIVE),
    ]),
    methodRecipe(graph, [ORDER_CONSUMER, 'unarchiveCustomer'], {
      initializers: {
        originalCustomer: 'customerService.getCustomer(event.customerId())',
        updatedCustomer: 'originalCustomer.toBuilder().archivalData(null).build()',
      },
      calls: [SAVE_LIVE],
    }),
    orderCaught(
      graph,
      'unarchiveCustomer',
      'CustomerNotFoundException',
      'restoreCustomerFromArchive(event)',
    ),
    orderCaught(
      graph,
      'unarchiveCustomer',
      'CustomerServiceException',
      'log.warn("Failed to remove archival data from customer. OrderId: {}, CustomerId: {}, Error: {}",event.orderId(),event.customerId(),e.getMessage())',
    ),
    orderCaught(
      graph,
      'restoreCustomerFromArchive',
      'CustomerServiceException',
      'log.error("Failed to restore customer from archive. OrderId: {}, CustomerId: {}, Error: {}",event.orderId(),event.customerId(),restoreException.getMessage())',
    ),
  ].every(Boolean);
}
function boundaries(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const entries: readonly (readonly [string, string, readonly [string, string, number?]])[] = [
    ['consume', DECODE, ['OrderUpdateEventDeserializer', 'deserialize']],
    ['consume', UPDATE, [ORDER_CONSUMER, 'isCustomerUpdateEvent']],
    ['consume', 'isValidOrderEvent(event)', [ORDER_CONSUMER, 'isValidOrderEvent']],
    ['consume', UNARCHIVE, [ORDER_CONSUMER, 'unarchiveCustomer']],
    ['consume', 'determineArchiveReason(event)', [ORDER_CONSUMER, 'determineArchiveReason']],
    ['consume', MARK, ['CustomerService', 'markForArchival']],
    [
      'unarchiveCustomer',
      'customerService.getCustomer(event.customerId())',
      ['CustomerService', 'getCustomer', 1],
    ],
    ['unarchiveCustomer', SAVE_LIVE, ['CustomerService', 'saveCustomer']],
    [
      'unarchiveCustomer',
      'restoreCustomerFromArchive(event)',
      [ORDER_CONSUMER, 'restoreCustomerFromArchive'],
    ],
    [
      'restoreCustomerFromArchive',
      'customerArchiveService.restoreCustomerFromArchive(event.customerId(),false)',
      ['CustomerArchiveService', 'restoreCustomerFromArchive', 2],
    ],
  ];
  return Object.fromEntries(
    entries.map(([method, recipe, target]) => [
      `boundary:${method}:${recipe}`,
      orderBoundary(graph, [ORDER_CONSUMER, method], recipe, target),
    ]),
  );
}
function saveEffects(graph: ProfileGraph): boolean {
  const mark = messageMethod(graph, ['CustomerService', 'markForArchival']);
  const branch = descendants(graph, mark).find((node) => node.nodeKind === 'if');
  return [
    orderValueApplied(graph, { owner: mark, name: 'customer', call: SAVE_POST, position: 1 }),
    orderValueApplied(graph, { owner: mark, name: 'originalCustomer', call: SAVE_POST }),
    methodRecipe(graph, ['CustomerService', 'markForArchival'], {
      initializers: {
        originalCustomer: 'getCustomer(customerId)',
        archivalData: 'ArchivalData(reason,Instant.now().plus(90,DAYS))',
        customer: 'originalCustomer.toBuilder().archivalData(archivalData).build()',
      },
      branches: [{ condition: 'originalCustomer.archivalData()!=null', exits: true }],
      calls: [SAVE_POST],
    }),
    orderExit(graph, branch),
    orderBefore(graph, mark, [branch, messageCall(graph, mark, SAVE_POST)]),
    orderBoundary(graph, ['CustomerService', 'markForArchival'], SAVE_POST, [
      'CustomerService',
      'saveAndPostProcess',
    ]),
    methodRecipe(graph, ['CustomerService', 'saveCustomer'], {
      calls: ['customerValidatorService.validate(customer)', 'customerRepository.save(customer)'],
      returns: ['customer'],
    }),
    !graph.calls.some(
      (call) =>
        new Set([messageMethod(graph, ['CustomerService', 'saveCustomer'])?.source]).has(
          call.caller ?? '',
        ) && new Set(['postProcess']).has(call.methodName),
    ),
  ].every(Boolean);
}

/** Frozen Q19 source question; every clause is evaluated on typed bounded records. */
export function orderQuestionProof(document: ScanDocument): EventQuestionProof {
  const graph = profileGraph(document);
  const clauses = {
    ...orderEffects(graph),
    payloadProjections: orderPayloadProjections(graph),
    decodeContract: orderDecodeContract(graph),
    catchOrder: orderCatchOrder(graph),
    liveLookup: orderLiveLookup(graph),
    restorationLookup: orderRestoreLookup(graph),
    filterConstants: filterConstants(graph),
    statusList: statusList(graph),
    eventLineage: methodRecipe(graph, [ORDER_CONSUMER, 'consume'], {
      initializers: {
        event: DECODE,
        archiveReason: 'determineArchiveReason(event)',
      },
    }),
    decodedEventApplied: orderValueApplied(graph, {
      owner: orderMethod(graph, 'consume'),
      name: 'event',
      call: UPDATE,
    }),
    reasonApplied: orderValueApplied(graph, {
      owner: orderMethod(graph, 'consume'),
      name: 'archiveReason',
      call: MARK,
      position: 1,
    }),
    updateFilter: orderPredicate(
      graph,
      'isCustomerUpdateEvent',
      'payload!=null&&CUSTOMER_UPDATE_CATEGORY.equals(payload.category())&&StringUtils.hasText(payload.customerId())',
    ),
    orderFilter: orderPredicate(
      graph,
      'isValidOrderEvent',
      'payload!=null&&VALID_ORDER_STATUSES.contains(payload.orderStatus())&&ORDER_EVENT_TYPE.equals(payload.eventType())&&ORDER_TYPE.equals(payload.orderType())&&StringUtils.hasText(payload.customerId())',
    ),
    priority: priority(graph),
    reasonMapping: reasons(graph),
    unarchive: unarchive(graph),
    ...boundaries(graph),
    saveEffects: saveEffects(graph),
  };
  return {
    supported: Object.values(clauses).every(Boolean),
    clauses,
    details: [
      'CustomerUpdate with a nonblank customer ID takes precedence. Other non-null events require COMPLETED, CANCELLED or ABANDONED, ORDERCHANGEEVENT, BASIC and a nonblank ID. Statuses map to ORDER_COMPLETED, ORDER_CANCELLED and ABANDONED.',
      'Live updates clear archival data and use saveCustomer, which validates and saves without postprocessing; missing live customers invoke archive restoration with false. Failures caught locally log. Broker delivery, runtime activation and durable database completion remain unobserved.',
    ],
  };
}
