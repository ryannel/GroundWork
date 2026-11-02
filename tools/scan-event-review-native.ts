import type { EventBinding } from '@/infrastructure/scan/spring-event-types';

import { FIELDS, GUARDS } from './scan-event-review-expectations';
import { profileMethod, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { descendants, targets } from './scan-semantic-query';

function nativeGuards(graph: ProfileGraph, send: EventBinding | undefined): boolean {
  if (!send) return false;
  return GUARDS.every((expected) =>
    send.conditions.some((condition) => {
      if (individualRecipe(graph, graph.bySource.get(condition.condition_source)) !== expected) {
        return false;
      }
      const body = targets(graph, graph.bySource.get(condition.source), 'consequent')[0];
      if (
        !new Set([body?.source]).has(condition.consequent_source ?? '') ||
        condition.return_sources.length === 0
      ) {
        return false;
      }
      const returns = new Set(
        descendants(graph, body)
          .filter((node) => node.nodeKind === 'return')
          .map((node) => node.source),
      );
      return condition.return_sources.every((source) => returns.has(source));
    }),
  );
}
function nativeComparison(graph: ProfileGraph, send: EventBinding | undefined): boolean {
  return (
    send?.comparisons.some((comparison) => {
      const node = graph.bySource.get(comparison.source);
      const recipe = individualRecipe(graph, node);
      const operands = [...targets(graph, node, 'left'), ...targets(graph, node, 'right')];
      return (
        comparison.operator === 'CONDITIONAL_OR' &&
        recipe ===
          '!Objects.equals(individual.consentInfo(),previousIndividual.consentInfo())||!Objects.equals(individual.cdbId(),previousIndividual.cdbId())' &&
        comparison.operand_sources.join(',') === operands.map((operand) => operand.source).join(',')
      );
    }) === true
  );
}
function nativePayload(graph: ProfileGraph, send: EventBinding | undefined): boolean {
  const payload = send?.constructions.find(
    (record) => record.type?.endsWith('.MarketingConsentEventPayload') === true,
  );
  if (payload?.fields.length !== FIELDS.length) return false;
  const schema = graph.document.framework
    ?.filter((record) => record.kind === 'schema_binding')
    .find((record) => record.typeName === payload.type);
  return FIELDS.every(([field, recipe], position) => {
    const bound = payload.fields[position];
    if (bound?.field !== field || payload.argument_sources[position] !== bound.value_source) {
      return false;
    }
    return (
      individualRecipe(graph, graph.bySource.get(bound.value_source)) === recipe &&
      schema?.properties.some(
        (property) => property.name === field && property.source === bound.field_source,
      ) === true
    );
  });
}
function nativeSend(graph: ProfileGraph, selected: readonly EventBinding[]): boolean {
  const send = selected.find((record) => record.operation === 'sendSafely');
  const message = selected.find((record) => record.operation === 'buildEventMessage');
  if (!send || !message || send.arguments.length !== 2) return false;
  const argumentsMatch = send.arguments.every(
    (argument, position) =>
      argument.position === position &&
      argument.role === ['template', 'message'][position] &&
      individualRecipe(graph, graph.bySource.get(argument.source)) ===
        ['kafkaTemplate', 'message'][position],
  );
  const rolesMatch =
    message.arguments.map((argument) => argument.role).join(',') ===
    'topic_selector,key,event,version,producer';
  const valuesMatch =
    message.arguments
      .map((argument) => individualRecipe(graph, graph.bySource.get(argument.source)))
      .join(',') ===
    'eventSettings.topicName(),updated.customerId(),event,VERSION,ECOM_CUSTOMER_SERVICE';
  return [
    send.result_observation === 'discarded',
    send.contract === 'external_sdk_source',
    argumentsMatch,
    rolesMatch,
    valuesMatch,
  ].every(Boolean);
}
function helperFlow(graph: ProfileGraph, send: EventBinding | undefined): boolean {
  const payloadMethod = profileMethod(graph, 'MarketingConsentEventService', 'buildPayload')[0];
  if (!send || !payloadMethod) return false;
  return (
    send.candidate_helpers.some((candidate) => {
      const call = graph.bySource.get(candidate.call_source);
      const actual = targets(graph, call, 'argument').map((argument) => argument.source);
      const formal = targets(graph, payloadMethod, 'parameter').map(
        (parameter) => parameter.source,
      );
      const targetMatches = candidate.target_source === payloadMethod.source;
      const recipesMatch =
        individualRecipe(graph, call) ===
        'buildPayload(individual,updated.market().getCountryCode())';
      return [
        targetMatches,
        recipesMatch,
        actual.join(',') === candidate.argument_sources.join(','),
        formal.join(',') === candidate.parameter_sources.join(','),
      ].every(Boolean);
    }) ||
    graph.calls.some(
      (call) => call.methodName === 'buildPayload' && call.target === payloadMethod.source,
    )
  );
}

export function nativeConsent(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const owner = profileMethod(graph, 'MarketingConsentEventService', 'publishEvent')[0];
  const selected = (graph.document.bindings ?? [])
    .filter((record) => record.kind === 'event_binding')
    .filter((record) => record.owner_source === owner?.source);
  const send = selected.find((record) => record.operation === 'sendSafely');
  return {
    nativeGuards: nativeGuards(graph, send),
    nativeComparison: nativeComparison(graph, send),
    nativePayload: nativePayload(graph, send),
    payloadApplied:
      send?.builder_calls.some(
        (call) =>
          call.operation === 'payload' &&
          call.argument_sources.length === 1 &&
          individualRecipe(graph, graph.bySource.get(call.argument_sources[0] ?? '')) ===
            'buildPayload(individual,updated.market().getCountryCode())',
      ) === true,
    payloadHelperLineage: helperFlow(graph, send),
    nativeSend: nativeSend(graph, selected),
  };
}
