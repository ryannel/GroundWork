import { messageCall } from './scan-message-review-graph';
import { ORDER_CONSUMER, orderMethod, orderNodes } from './scan-order-review-graph';
import { profileScalar, type ProfileGraph } from './scan-profile-review-graph';
import { targets } from './scan-semantic-query';

export function filterConstants(graph: ProfileGraph): boolean {
  const expected: Readonly<Record<string, string>> = {
    CUSTOMER_UPDATE_CATEGORY: 'CustomerUpdate',
    ORDER_EVENT_TYPE: 'ORDERCHANGEEVENT',
    ORDER_TYPE: 'BASIC',
  };
  const filterSources = new Set(
    ['isCustomerUpdateEvent', 'isValidOrderEvent'].flatMap((method) =>
      orderNodes(graph, method).map((node) => node.source),
    ),
  );
  return Object.entries(expected).every(([name, value]) => {
    const binding = graph.document.bindings?.find(
      (entry) =>
        entry.kind === 'java_constant_binding' &&
        entry.owner_type.endsWith(`.${ORDER_CONSUMER}`) &&
        entry.name === name,
    );
    return (
      binding?.kind === 'java_constant_binding' &&
      binding.value === value &&
      graph.values.some(
        (entry) =>
          entry.relation === 'reference' &&
          entry.from === binding.source &&
          filterSources.has(entry.to),
      )
    );
  });
}
export function statusList(graph: ProfileGraph): boolean {
  const list = graph.document.bindings?.find(
    (entry) =>
      entry.kind === 'java_collection_binding' &&
      entry.name === 'VALID_ORDER_STATUSES' &&
      entry.owner_type.endsWith(`.${ORDER_CONSUMER}`),
  );
  if (list?.kind !== 'java_collection_binding') return false;
  const contains = messageCall(
    graph,
    orderMethod(graph, 'isValidOrderEvent'),
    'VALID_ORDER_STATUSES.contains(payload.orderStatus())',
  );
  const receiver = targets(graph, targets(graph, contains, 'callee')[0], 'receiver')[0];
  return [
    list.elements.length === 3,
    graph.calls.some(
      (call) =>
        call.id === list.factory_call_binding_id &&
        call.call === list.value_source &&
        call.receiverType === 'java.util.List' &&
        call.methodName === 'of',
    ),
    graph.values.some(
      (value) =>
        value.relation === 'reference' &&
        value.from === list.source &&
        value.to === receiver?.source,
    ),
    list.elements.every((element, position) =>
      [
        element.position === position,
        element.value === ['COMPLETED', 'CANCELLED', 'ABANDONED'][position],
        element.constant_source !== null,
        profileScalar(graph, element.constant_source ?? '') === element.value,
        graph.values.some(
          (value) =>
            value.relation === 'reference' &&
            value.from === element.constant_source &&
            value.to === element.source,
        ),
      ].every(Boolean),
    ),
  ].every(Boolean);
}
