import type { ScanDocument, SemanticNode } from '@/domain/scan/scan.generated';

import {
  messageBoundary,
  messageBranches,
  messageCall,
  messageGuardBeforeEffects,
  messageLocal,
  messageMethod,
} from './scan-message-review-graph';
import { profileGraph, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { methodRecipe } from './scan-profile-review-method';
import { descendants, targets } from './scan-semantic-query';

const EVENT_TYPE_CALL = 'getEventType(previous,updated)';
const ENVELOPE =
  'kafkaEventPublisher.buildEventMessage(settings.topicName(),updated.customerId(),event,VERSION,PRODUCER_ID)';
const SERVICES = [
  [
    'CustomerEventService',
    'publishCustomerEvent',
    'CustomerEventType.CUSTOMER_CREATED',
    'CustomerEventType.CUSTOMER_ARCHIVED',
    'CustomerEventType.CUSTOMER_UPDATED',
  ],
  [
    'AnalyticsEventService',
    'publishAnalyticsEvent',
    'EventType.CREATED',
    'EventType.DELETED',
    'EventType.UPDATED',
  ],
] as const;

function selectorLineage(graph: ProfileGraph, identity: readonly [string, string]): boolean {
  const owner = messageMethod(graph, identity);
  const call = messageCall(graph, owner, EVENT_TYPE_CALL);
  const selectorMethod = messageMethod(graph, [identity[0], 'getEventType']);
  const returnType =
    identity[0] === 'CustomerEventService'
      ? 'messaging.CustomerEventType'
      : 'analytics.model.AnalyticsEvent.EventType';
  const binding = graph.calls.find((entry) => entry.call === call?.source);
  return (
    messageBoundary(graph, call, selectorMethod) &&
    messageLocal(graph, owner) &&
    binding?.signature?.endsWith(`:com.volvocars.ecom.customerservice.${returnType}`) === true
  );
}

function attemptOrder(
  graph: ProfileGraph,
  owner: SemanticNode | undefined,
  calls: readonly (SemanticNode | undefined)[],
): boolean {
  const statements = targets(graph, targets(graph, owner, 'body')[0], 'statement');
  const indices = calls.map((call) =>
    statements.findIndex((statement) =>
      descendants(graph, statement).some((node) => node.id === call?.id),
    ),
  );
  const [buildAt = -1, sendAt = -1] = indices;
  return indices.length === 2 && buildAt > 0 && sendAt > buildAt;
}

function sends(graph: ProfileGraph, identity: readonly [string, string]): boolean {
  const owner = messageMethod(graph, identity);
  const analytics = identity[0] === 'AnalyticsEventService';
  const recipe = analytics
    ? 'kafkaTemplate.send(message)'
    : 'kafkaEventPublisher.sendSafely(kafkaTemplate,message)';
  const send = messageCall(graph, owner, recipe);
  const build = messageCall(graph, owner, ENVELOPE);
  const records =
    graph.document.bindings
      ?.filter((record) => record.kind === 'event_binding')
      .filter((record) => record.owner_source === owner?.source) ?? [];
  const attempt = records.find((record) => record.source === send?.source);
  const envelope = records.find((record) => record.source === build?.source);
  if (!attempt || !envelope || !send || !build) return false;
  const argumentsMatch = attempt.arguments.every(
    (argument, ordinal) => argument.source === targets(graph, send, 'argument')[ordinal]?.source,
  );
  return [
    attempt.arguments.length === (analytics ? 1 : 2),
    argumentsMatch,
    envelope.arguments.length === 5,
    envelope.arguments.every(
      (argument, ordinal) => argument.source === targets(graph, build, 'argument')[ordinal]?.source,
    ),
    envelope.arguments.map((argument) => argument.role).join(',') ===
      'topic_selector,key,event,version,producer',
    graph.calls.some(
      (call) => call.call === send.source && attempt.call_binding_ids.includes(call.id),
    ),
    graph.calls.some(
      (call) => call.call === build.source && envelope.call_binding_ids.includes(call.id),
    ),
    messageGuardBeforeEffects(graph, owner),
    attemptOrder(graph, owner, [build, send]),
    messageLocal(graph, owner),
    attempt.gaps.length > 0,
  ].every(Boolean);
}

function selectorMethodPayload(graph: ProfileGraph): boolean {
  const publish = messageMethod(graph, ['AnalyticsEventService', 'publishAnalyticsEvent']);
  const mapper = messageMethod(graph, ['AnalyticsCustomerMapper', 'to']);
  return (
    messageBoundary(
      graph,
      messageCall(graph, publish, 'customerMapper.to(updated,fleetAccount)'),
      mapper,
    ) &&
    messageBoundary(
      graph,
      messageCall(graph, publish, 'getFleetAccount(updated)'),
      messageMethod(graph, ['AnalyticsEventService', 'getFleetAccount']),
    )
  );
}

function messageFlow(graph: ProfileGraph): boolean {
  return (
    methodRecipe(graph, ['CustomerEventService', 'publishCustomerEvent'], {
      initializers: {
        eventType: EVENT_TYPE_CALL,
        payload: 'CustomerEventPayload(updated.customerId(),updated.version(),updated.modified())',
        event: 'eventBuilder.metadata(buildMetadata(eventType)).payload(payload).build()',
        message: ENVELOPE,
      },
    }) &&
    methodRecipe(graph, ['AnalyticsEventService', 'publishAnalyticsEvent'], {
      initializers: {
        eventType: EVENT_TYPE_CALL,
        fleetAccount: 'getFleetAccount(updated)',
        analyticsCustomer: 'customerMapper.to(updated,fleetAccount)',
        event: 'AnalyticsEvent(analyticsCustomer,eventType)',
        message: ENVELOPE,
      },
    })
  );
}

function metadataFlow(graph: ProfileGraph): boolean {
  const owner = messageMethod(graph, ['CustomerEventService', 'publishCustomerEvent']);
  return (
    messageBoundary(
      graph,
      messageCall(graph, owner, 'buildMetadata(eventType)'),
      messageMethod(graph, ['CustomerEventService', 'buildMetadata']),
    ) &&
    methodRecipe(graph, ['CustomerEventService', 'buildMetadata'], {
      calls: [
        'Metadata.builder().id(UUID.randomUUID().toString()).version("1.0").correlationId(LogUtils.getCorrelationId()).type(eventType.toString())',
      ],
    })
  );
}

export function messagePublishClauses(document: ScanDocument): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  const calls = descendants(graph, messageMethod(graph, ['AnalyticsCustomerMapper', 'to'])).filter(
    (node) => node.nodeKind === 'call',
  );
  return {
    eventBranchValues: SERVICES.every(([file, , created, archived, updated]) =>
      messageBranches(graph, [file, 'getEventType'], [created, archived, updated]),
    ),
    eventSelectionLineage: SERVICES.every(([file, method]) =>
      selectorLineage(graph, [file, method]),
    ),
    payloadEnvelopeSendLineage:
      messageFlow(graph) && SERVICES.every(([file, method]) => sends(graph, [file, method])),
    customerMetadataType: metadataFlow(graph),
    analyticsMapperBoundary: selectorMethodPayload(graph),
    analyticsMapperApplications: [
      'customerTypeMapper.to(customer,fleetAccount)',
      'individualMapper.to(customer.individuals())',
      'corporateEntityMapper.to(customer.corporateEntities())',
    ].every((recipe) => {
      const call = calls.find((node) => individualRecipe(graph, node) === recipe);
      const binding = graph.calls.find((entry) => entry.call === call?.source);
      const target = graph.bySource.get(binding?.target ?? '');
      return messageBoundary(graph, call, target);
    }),
  };
}
