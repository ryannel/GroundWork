import 'server-only';

import type { CallBinding } from './java-call-binding-types';
import { javaTypeName, javaTypeParts } from './java-call-types';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { JavaAnnotation, JavaUnit } from './java-declarations';
import { consumerArguments, consumerMapperCall, consumerNode } from './spring-consumer-source';
import type { ConsumerBinding } from './spring-consumer-types';
import type { OutboundInput } from './spring-outbound-provenance';
import { springLiteral } from './spring-route-values';

export function consumerFactories(
  input: OutboundInput,
  annotation: JavaAnnotation,
): ConsumerBinding['factory_candidates'] {
  const name = springLiteral(annotation.arguments.containerFactory ?? '');
  if (name === undefined) return [];
  return input.units.flatMap((unit) => factoryCandidates(unit, name));
}

function factoryCandidates(unit: JavaUnit, name: string): ConsumerBinding['factory_candidates'] {
  return unit.types.flatMap((type) =>
    type.methods.flatMap((method) => {
      const bean = method.annotations.find(
        (entry) => entry.name === 'org.springframework.context.annotation.Bean',
      );
      if (
        !bean ||
        ![method.name, springLiteral(bean.arguments.value ?? bean.arguments.name ?? '')].includes(
          name,
        )
      ) {
        return [];
      }
      const returnType = javaTypeName(method.returnType, unit);
      if (
        javaTypeParts(returnType).base !==
        'org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory'
      ) {
        return [];
      }
      return [
        {
          source: method.source,
          annotation_source: bean.source,
          return_type: returnType,
          selection: 'source_name_candidate' as const,
        },
      ];
    }),
  );
}

export function consumerDeserialisations(
  input: OutboundInput,
  calls: readonly CallBinding[],
): ConsumerBinding['deserialisations'] {
  return calls.flatMap((call) => {
    if (!consumerMapperCall(call) || call.caller === null) {
      return [];
    }
    for (const unit of input.units) {
      for (const type of unit.types) {
        const method = type.methods.find((entry) => entry.source === call.caller);
        if (!method) continue;
        const selected = consumerNode(input, call.call);
        if (!selected) return [];
        const argumentSources = new Set(consumerArguments(input, call));
        const referenceSources = new Set(
          input.values
            .filter((value) => value.relation === 'reference' && argumentSources.has(value.to))
            .map((value) => value.from),
        );
        const references = type.fields.filter(
          (field) =>
            referenceSources.has(field.source) &&
            [
              'tools.jackson.core.type.TypeReference',
              'com.fasterxml.jackson.core.type.TypeReference',
            ].includes(javaTypeParts(javaTypeName(field.type, unit)).base),
        );
        return [
          {
            source: call.call,
            owner_source: method.source,
            receiver_type: call.receiverType ?? '',
            argument_sources: consumerArguments(input, call),
            return_type: javaTypeName(method.returnType, unit),
            type_reference_sources: references.map((field) => field.source),
          },
        ];
      }
    }
    return [];
  });
}

export function consumerModels(
  input: OutboundInput,
  types: readonly string[],
): ConsumerBinding['model_declarations'] {
  const selected = new Set<string>();
  function visit(type: string) {
    const parts = javaTypeParts(type);
    selected.add(parts.base);
    for (const argument of parts.arguments) visit(argument);
  }
  for (const type of types) visit(type);
  return input.units.flatMap((unit) =>
    unit.types
      .filter((type) => selected.has(type.qualifiedName))
      .map((type) => ({
        source: type.source,
        type: type.qualifiedName,
        field_sources: type.fields.map((field) => field.source),
      })),
  );
}

export function consumerSelectorSources(
  input: OutboundInput,
  annotation: JavaAnnotation,
): ReadonlyMap<string, string> {
  const selected = consumerNode(input, annotation.source);
  if (!selected) return new Map<string, string>();
  return new Map(
    declarationChildren(selected.index, selected.node, 'arguments').map((node) => {
      const key = declarationChildren(selected.index, node, 'targets')[0]?.text ?? 'value';
      const value = declarationChildren(selected.index, node, 'values')[0] ?? node;
      return [key, declarationSource(selected.index, value)];
    }),
  );
}

/** Conditional declarations establish source guards, not effective bean activation. */
function conditionDeclarations(owner: {
  readonly source: string;
  readonly annotations: readonly JavaAnnotation[];
}): ConsumerBinding['conditions'] {
  return owner.annotations.flatMap((annotation) => {
    if (
      annotation.name !== 'org.springframework.boot.autoconfigure.condition.ConditionalOnBean' &&
      annotation.name !== 'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty'
    ) {
      return [];
    }
    return [
      {
        source: annotation.source,
        owner_source: owner.source,
        annotation_type: annotation.name,
        arguments: Object.entries(annotation.arguments).map(([name, expression]) => ({
          name,
          expression,
        })),
      },
    ];
  });
}

export function consumerConditions(
  input: OutboundInput,
  owners: ReadonlySet<string>,
): ConsumerBinding['conditions'] {
  return input.units
    .flatMap((unit) => unit.types)
    .flatMap((type) => [type, ...type.methods])
    .filter((entry) => owners.has(entry.source))
    .flatMap(conditionDeclarations);
}

export function consumerFactoryOwners(
  input: OutboundInput,
  factories: ConsumerBinding['factory_candidates'],
): readonly string[] {
  return input.units
    .flatMap((unit) => unit.types)
    .filter((type) =>
      type.methods.some((method) => factories.some((factory) => factory.source === method.source)),
    )
    .map((type) => type.source);
}
