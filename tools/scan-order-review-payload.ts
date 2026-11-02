import { messageCall } from './scan-message-review-graph';
import { orderMethod, orderNodes } from './scan-order-review-graph';
import type { ProfileGraph } from './scan-profile-review-graph';
import { targets } from './scan-semantic-query';

const PAYLOAD = 'com.volvocars.ecom.customerservice.messaging.consumer.OrderUpdateEventPayload';
export function orderPayloadProjections(graph: ProfileGraph): boolean {
  const schema = graph.document.framework?.find(
    (record) => record.kind === 'schema_binding' && record.typeName === PAYLOAD,
  );
  if (schema?.kind !== 'schema_binding') return false;
  const owners = new Set(
    [
      'consume',
      'isCustomerUpdateEvent',
      'isValidOrderEvent',
      'unarchiveCustomer',
      'restoreCustomerFromArchive',
      'determineArchiveReason',
    ].map((method) => orderMethod(graph, method)?.source),
  );
  const fields = new Map(schema.properties.map((field) => [field.name, field]));
  const accesses = graph.calls.filter(
    (call) => owners.has(call.caller ?? '') && call.receiverType === PAYLOAD,
  );
  return (
    accesses.length > 0 &&
    accesses.every((call) => {
      const field = fields.get(call.methodName);
      return (
        field?.type === 'String' &&
        graph.values.some(
          (value) =>
            value.relation === 'field_projection' &&
            value.from === field.source &&
            value.to === call.call,
        )
      );
    })
  );
}
export function orderCatchOrder(graph: ProfileGraph): boolean {
  const attempt = orderNodes(graph, 'unarchiveCustomer').find((node) => node.nodeKind === 'try');
  const types = targets(graph, attempt, 'catch').map((clause) => {
    const parameter = targets(graph, clause, 'parameter')[0];
    return (
      targets(graph, parameter, 'declared_type')[0] ?? targets(graph, clause, 'declared_type')[0]
    )?.name;
  });
  return types.join(',') === 'CustomerNotFoundException,CustomerServiceException';
}
export function orderDecodeContract(graph: ProfileGraph): boolean {
  const owner = orderMethod(graph, 'consume');
  const consumer = graph.document.bindings?.find(
    (record) => record.kind === 'consumer_binding' && record.source === owner?.source,
  );
  const decode = messageCall(graph, owner, 'orderUpdateEventDeserializer.deserialize(eventJson)');
  const schema = graph.document.framework?.find(
    (record) =>
      record.kind === 'schema_binding' && record.typeName.endsWith('.OrderUpdateEventDeserializer'),
  );
  const reference =
    schema?.kind === 'schema_binding'
      ? schema.properties.find((field) => field.name === 'orderTypeRef')
      : undefined;
  return [
    consumer?.kind === 'consumer_binding',
    decode !== undefined,
    reference?.type === 'TypeReference<OrderUpdateEventPayload>',
    consumer?.kind === 'consumer_binding' &&
      consumer.deserialisations.some(
        (entry) =>
          entry.receiver_type === 'tools.jackson.databind.json.JsonMapper' &&
          entry.return_type === PAYLOAD &&
          entry.type_reference_sources.includes(reference?.source ?? ''),
      ),
  ].every(Boolean);
}
