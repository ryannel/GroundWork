import type { ScanDocument } from '@/domain/scan/scan.generated';
import type { ConsumerBinding } from '@/infrastructure/scan/spring-consumer-types';

import { messageConfigurationValue } from './scan-message-review-configuration';
import { messageConsumerConfiguration } from './scan-message-review-consumer-config';
import {
  messageBoundary,
  messageCall,
  messageLocal,
  messageMethod,
} from './scan-message-review-graph';
import { profileGraph, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { methodRecipe } from './scan-profile-review-method';
import { descendants, targets } from './scan-semantic-query';

const DECODE = 'deleteCustomerDeserializer.deserialize(eventJson)';
const PAYLOAD = 'com.volvocars.ecom.customerservice.messaging.consumer.DeleteCustomerEventPayload';
const APPLICATION = 'application.yml';
const ENABLED = 'kafka.delete-customer-event.enabled';
const EVENT = `com.volvocars.services.common.messaging.v2.Event<${PAYLOAD}>`;

function subscription(graph: ProfileGraph, binding: ConsumerBinding | undefined): boolean {
  const owner = messageMethod(graph, ['DeleteCustomerEventConsumer', 'consume']);
  if (!binding || binding.source !== owner?.source) return false;
  const expected: readonly (readonly [ConsumerBinding['selectors'][number]['role'], string])[] = [
    ['topics', `\${kafka.delete-customer-event.topic-name}`],
    ['groupId', `\${kafka.delete-customer-event.group-id}`],
    ['containerFactory', 'deleteCustomerConsumerFactory'],
  ];
  return [
    expected.every(([role, literal]) =>
      binding.selectors.some(
        (selector) =>
          selector.role === role &&
          selector.literal === literal &&
          graph.document.sources.some((source) => source.id === selector.source),
      ),
    ),
    binding.parameters.length === 1,
    binding.parameters[0]?.source === targets(graph, owner, 'parameter')[0]?.source,
    binding.parameters[0]?.type === 'java.lang.String',
    binding.parameters[0]?.payload_annotation_source !== null,
  ].every(Boolean);
}

function candidateDelete(graph: ProfileGraph, binding: ConsumerBinding | undefined): boolean {
  const owner = messageMethod(graph, ['DeleteCustomerEventConsumer', 'consume']);
  const call = messageCall(
    graph,
    owner,
    'customerService.deleteCustomer(event.getPayload().customerId())',
  );
  const target = messageMethod(graph, ['CustomerService', 'deleteCustomer']);
  if (!binding || !call || !target) return false;
  if (messageBoundary(graph, call, target)) return true;
  return binding.candidate_helpers.some(
    (candidate) =>
      candidate.call_source === call.source &&
      candidate.target_source === target.source &&
      candidate.argument_sources.join(',') ===
        targets(graph, call, 'argument')
          .map((node) => node.source)
          .join(',') &&
      candidate.parameter_sources.join(',') ===
        targets(graph, target, 'parameter')
          .map((node) => node.source)
          .join(','),
  );
}

function deserialisation(graph: ProfileGraph, binding: ConsumerBinding | undefined): boolean {
  const consume = messageMethod(graph, ['DeleteCustomerEventConsumer', 'consume']);
  const deserialiser = messageMethod(graph, ['DeleteCustomerEventDeserializer', 'deserialize']);
  if (!consume || !deserialiser) return false;
  const read = messageCall(
    graph,
    deserialiser,
    'objectMapper.readValue(json,deleteCustomerTypeRef)',
  );
  const schema = graph.document.framework
    ?.filter((record) => record.kind === 'schema_binding')
    .find((record) => record.typeName.endsWith('.DeleteCustomerEventDeserializer'));
  const reference = schema?.properties.find(
    (property) => property.name === 'deleteCustomerTypeRef',
  );
  return [
    reference?.type === 'TypeReference<Event<DeleteCustomerEventPayload>>',
    graph.values.some(
      (value) =>
        value.relation === 'reference' &&
        value.from === reference?.source &&
        value.to === targets(graph, read, 'argument')[1]?.source,
    ),
    binding?.deserialisations.some((entry) =>
      entry.type_reference_sources.includes(reference?.source ?? ''),
    ) === true,
    targets(graph, deserialiser, 'declared_type')[0]?.name === 'Event<DeleteCustomerEventPayload>',
    messageBoundary(graph, messageCall(graph, consume, DECODE), deserialiser),
    messageLocal(graph, consume),
    binding?.calls.some(
      (entry) =>
        entry.source === messageCall(graph, consume, DECODE)?.source &&
        entry.owner_source === consume.source &&
        entry.target_source === deserialiser.source &&
        entry.execution === 'direct_source',
    ) === true,
    messageLocal(graph, deserialiser),
    methodRecipe(graph, ['DeleteCustomerEventConsumer', 'consume'], {
      initializers: { event: DECODE },
      calls: ['LogUtils.setCorrelationId(event.getMetadata().getCorrelationId())'],
    }),
    methodRecipe(graph, ['DeleteCustomerEventDeserializer', 'deserialize'], {
      returns: ['objectMapper.readValue(json,deleteCustomerTypeRef)'],
    }),
    binding?.deserialisations.some((entry) =>
      [
        entry.source === read?.source,
        entry.owner_source === deserialiser.source,
        entry.receiver_type === 'tools.jackson.databind.json.JsonMapper',
        entry.return_type === EVENT,
        entry.argument_sources.join(',') ===
          targets(graph, read, 'argument')
            .map((node) => node.source)
            .join(','),
        entry.type_reference_sources.length > 0,
      ].every(Boolean),
    ) === true,
  ].every(Boolean);
}

function failure(graph: ProfileGraph, binding: ConsumerBinding | undefined): boolean {
  const deserialiser = messageMethod(graph, ['DeleteCustomerEventDeserializer', 'deserialize']);
  const caught = descendants(graph, deserialiser).filter((node) => node.nodeKind === 'catch');
  const clause = caught[0];
  const parameter = targets(graph, clause, 'parameter')[0];
  const throwNodes = descendants(graph, targets(graph, clause, 'body')[0]).filter(
    (node) => node.nodeKind === 'throw',
  );
  const exception = targets(graph, throwNodes[0], 'value')[0];
  const argument = targets(graph, exception, 'argument')[1];
  return [
    caught.length === 1,
    descendants(graph, deserialiser)
      .filter((node) => node.nodeKind === 'try')
      .some((node) => targets(graph, node, 'catch').some((body) => body.id === clause?.id)),
    targets(graph, parameter, 'declared_type')[0]?.name === 'JacksonException',
    throwNodes.length === 1,
    individualRecipe(graph, exception) ===
      'CustomerServiceException("Failed to deserialize PaymentEventPayload",e)',
    graph.values.some(
      (entry) =>
        entry.relation === 'reference' &&
        entry.from === parameter?.source &&
        entry.to === argument?.source,
    ),
    binding?.catch_sources.includes(clause?.source ?? '') === true,
    binding?.throw_sources.includes(throwNodes[0]?.source ?? '') === true,
    binding?.acknowledgement === 'unobserved',
    binding?.retry === 'unobserved',
    binding?.gaps.length !== 0,
  ].every(Boolean);
}

function deleteEffect(graph: ProfileGraph, binding: ConsumerBinding | undefined): boolean {
  const consume = messageMethod(graph, ['DeleteCustomerEventConsumer', 'consume']);
  const deletion = messageMethod(graph, ['CustomerService', 'deleteCustomer']);
  if (!deletion) return false;
  const call = messageCall(graph, deletion, 'customerRepository.deleteByCustomerId(customerId)');
  const calls = graph.calls.filter((entry) => entry.caller === deletion.source);
  const effects = calls.filter((entry) => entry.methodName !== 'info');
  const operation = graph.document.bindings
    ?.filter((entry) => entry.kind === 'mongo_operation_binding')
    .find((entry) => entry.source === call?.source);
  return [
    candidateDelete(graph, binding),
    messageLocal(graph, deletion),
    effects.length === 1,
    effects[0]?.call === call?.source,
    operation?.kind === 'mongo_operation_binding' &&
      operation.operation === 'write' &&
      operation.receiverType === 'com.volvocars.ecom.customerservice.customer.CustomerRepository',
    graph.document.bindings?.some(
      (entry) =>
        entry.kind === 'mongo_collection_binding' &&
        entry.id === operation?.collection_id &&
        entry.collection === 'customers',
    ) === true,
    !descendants(graph, consume).some((node) => ['catch', 'if'].includes(node.nodeKind)),
    !descendants(graph, deletion).some((node) => ['catch', 'if'].includes(node.nodeKind)),
    effects[0]?.receiverType === 'com.volvocars.ecom.customerservice.customer.CustomerRepository',
    targets(graph, targets(graph, deletion, 'body')[0], 'statement').some(
      (statement) =>
        individualRecipe(graph, statement) === 'customerRepository.deleteByCustomerId(customerId)',
    ),
  ].every(Boolean);
}

function payloadSchema(document: ScanDocument, binding: ConsumerBinding | undefined): boolean {
  const schema = document.framework?.find(
    (entry) => entry.kind === 'schema_binding' && entry.typeName === PAYLOAD,
  );
  if (schema?.kind !== 'schema_binding') return false;
  const field = schema.properties[0];
  return (
    schema.properties.length === 1 &&
    field?.name === 'customerId' &&
    field.type === 'String' &&
    binding?.model_declarations.some(
      (model) =>
        model.type === PAYLOAD &&
        model.source === schema.source &&
        model.field_sources.includes(field.source),
    ) === true
  );
}

function containerFactory(graph: ProfileGraph, binding: ConsumerBinding | undefined): boolean {
  const factory = messageMethod(graph, [
    'DeleteCustomerEventConfig',
    'getDeleteCustomerListenerContainerFactory',
  ]);
  return (
    binding?.factory_candidates.some(
      (candidate) =>
        candidate.source === factory?.source &&
        candidate.return_type ===
          'org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory<java.lang.String,java.lang.String>',
    ) === true &&
    methodRecipe(
      graph,
      ['DeleteCustomerEventConfig', 'getDeleteCustomerListenerContainerFactory'],
      {
        initializers: {
          consumerEventSettings:
            'KafkaConsumerEventSettings.builder().reconnectBackoff(eventSettings.reconnectBackoff()).reconnectBackoffMax(eventSettings.reconnectBackoffMax()).build()',
        },
        returns: ['buildListenerContainerFactory(kafkaSettings,consumerEventSettings,null)'],
      },
    )
  );
}

export function messageConsumerClauses(document: ScanDocument): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  const bindings =
    document.bindings
      ?.filter((record) => record.kind === 'consumer_binding')
      .filter(
        (record) =>
          record.owner_type ===
          'com.volvocars.ecom.customerservice.messaging.consumer.DeleteCustomerEventConsumer',
      ) ?? [];
  const binding = bindings.length === 1 ? bindings[0] : undefined;
  return {
    ...messageConsumerConfiguration(document, binding),
    subscription: subscription(graph, binding),
    containerFactory: containerFactory(graph, binding),
    declaredConsumerDefaults:
      messageConfigurationValue(document, [
        'kafka.delete-customer-event.topic-name',
        'app5541-delete-customer-events',
        APPLICATION,
      ]) &&
      messageConfigurationValue(document, [
        'kafka.delete-customer-event.group-id',
        'app5541-customer-integration-api',
        APPLICATION,
      ]) &&
      messageConfigurationValue(document, [ENABLED, true, APPLICATION]) &&
      messageConfigurationValue(document, [ENABLED, false, 'application-local.yml']),
    payloadSchema: payloadSchema(document, binding),
    deserialisationTargetAndInput: deserialisation(graph, binding),
    customerIdAndDeleteAttempt: deleteEffect(graph, binding),
    deserialisationFailureAndPolicyBoundary: failure(graph, binding),
  };
}
