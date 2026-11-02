import 'server-only';

import { javaTypeName } from './java-call-types';
import type { JavaAnnotation, JavaMethod, JavaType, JavaUnit } from './java-declarations';
import {
  consumerConditions,
  consumerFactoryOwners,
  consumerDeserialisations,
  consumerFactories,
  consumerModels,
  consumerSelectorSources,
} from './spring-consumer-model';
import { consumerCall, consumerSupport, ownedPaths } from './spring-consumer-relations';
import { consumerClosure } from './spring-consumer-source';
import type { ConsumerBinding } from './spring-consumer-types';
import type { OutboundInput } from './spring-outbound-provenance';
import { springLiteral } from './spring-route-values';

const LISTENER = 'org.springframework.kafka.annotation.KafkaListener';
const ROLES: readonly ConsumerBinding['selectors'][number]['role'][] = [
  'topics',
  'topicPattern',
  'topicPartitions',
  'groupId',
  'containerFactory',
  'batch',
  'autoStartup',
  'properties',
];

const GAPS = [
  'Listener selectors and factory names are source declarations; placeholders, SpEL, environment selection, activation and effective container configuration are unobserved.',
  'Jackson generic declarations and local model fields do not establish effective wire validation or external envelope/generated accessor implementation.',
  'Aggregated bodies cover the listener class synchronous lexical helpers and its immediate typed Jackson decoders; application-service, async and deferred targets remain separately navigable shared Java records.',
  'Nominal source helper candidates preserve argument/formal candidates without upgrading shared Java call resolution; overload ambiguity and external/abstract bodies remain unresolved.',
  'Source returns, catches and throws do not establish broker acknowledgement, retry, redelivery, transaction completion or durable storage outcome. Deferred and async declarations do not establish execution.',
];

function listenerSelectors(
  input: OutboundInput,
  annotation: JavaAnnotation,
): ConsumerBinding['selectors'] {
  const sources = consumerSelectorSources(input, annotation);
  return ROLES.flatMap((role) => {
    const expression = annotation.arguments[role];
    return expression === undefined
      ? []
      : [
          {
            role,
            expression,
            source: sources.get(role) ?? annotation.source,
            literal: springLiteral(expression) ?? null,
          },
        ];
  });
}

function listenerParameters(method: JavaMethod, unit: JavaUnit): ConsumerBinding['parameters'] {
  return method.parameters.map((parameter) => ({
    source: parameter.source,
    type: javaTypeName(parameter.type, unit),
    payload_annotation_source:
      parameter.annotations.find(
        (entry) => entry.name === 'org.springframework.messaging.handler.annotation.Payload',
      )?.source ?? null,
  }));
}

interface ListenerDeclaration {
  readonly owner: JavaType;
  readonly unit: JavaUnit;
  readonly method: JavaMethod;
  readonly annotation: JavaAnnotation;
}

function listenerIdentity(details: ListenerDeclaration) {
  return {
    kind: 'consumer_binding' as const,
    id: `consumer:${details.method.source}`,
    source: details.method.source,
    owner_source: details.owner.source,
    owner_type: details.owner.qualifiedName,
    annotation_source: details.annotation.source,
    activation: 'declared_runtime_unverified' as const,
    acknowledgement: 'unobserved' as const,
    retry: 'unobserved' as const,
    completeness: 'partial' as const,
    gaps: GAPS,
  };
}

function selectedCalls(input: OutboundInput, owners: ReadonlySet<string>) {
  return input.calls.filter((call) => call.caller !== null && owners.has(call.caller));
}

function declaration(input: OutboundInput, details: ListenerDeclaration): ConsumerBinding {
  const { owner, method, annotation } = details;
  const closure = consumerClosure(input, method.source);
  const calls = selectedCalls(input, closure.owners);
  const selectors = listenerSelectors(input, annotation);
  const parameters = listenerParameters(method, details.unit);
  const deserialisations = consumerDeserialisations(input, calls);
  const models = consumerModels(
    input,
    deserialisations.map((entry) => entry.return_type),
  );
  const factories = consumerFactories(input, annotation);
  const paths = ownedPaths(input, closure.owners);
  const callRecords = calls.map((call) => consumerCall(input, call));
  const support = consumerSupport({
    ...details,
    selectors,
    parameters,
    factories,
    deserialisations,
    models,
    callRecords,
    candidates: closure.candidates,
    paths,
  });
  const conditions = consumerConditions(
    input,
    new Set([
      owner.source,
      method.source,
      ...factories.map((factory) => factory.source),
      ...consumerFactoryOwners(input, factories),
    ]),
  );
  const conditionSupport = conditions.flatMap((condition) => [
    condition.source,
    condition.owner_source,
  ]);
  const sourceSet = new Set([...support, ...conditionSupport]);
  return {
    ...listenerIdentity(details),
    selectors,
    conditions,
    parameters,
    factory_candidates: factories,
    deserialisations,
    model_declarations: models,
    calls: callRecords,
    candidate_helpers: closure.candidates,
    return_sources: paths.returns,
    throw_sources: paths.throws,
    catch_sources: paths.catches,
    call_binding_ids: calls.map((call) => call.id),
    value_binding_ids: input.values
      .filter((value) => sourceSet.has(value.from) || sourceSet.has(value.to))
      .map((value) => value.id),
    support: [...sourceSet],
  };
}

function ownerBindings(
  input: OutboundInput,
  unit: JavaUnit,
  owner: JavaType,
): readonly ConsumerBinding[] {
  return owner.methods.flatMap((method) => {
    const annotation = method.annotations.find((entry) => entry.name === LISTENER);
    return annotation ? [declaration(input, { unit, owner, method, annotation })] : [];
  });
}

/** Exact annotation identity; tests, diagnostics and unrelated short annotation names cannot bind. */
export function collectConsumerBindings(input: OutboundInput): readonly ConsumerBinding[] {
  return input.units.flatMap((unit) => {
    const index = input.indexes.find((entry) => entry.path === unit.path);
    if (!index || index.diagnostics.length > 0 || !/(?:^|\/)src\/main\//u.test(unit.path)) {
      return [];
    }
    return unit.types.flatMap((owner) => ownerBindings(input, unit, owner));
  });
}
