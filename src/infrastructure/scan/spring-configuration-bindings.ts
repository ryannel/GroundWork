import 'server-only';

import {
  resolveJavaType,
  type JavaMethod,
  type JavaType,
  type JavaUnit,
} from './java-declarations';
import {
  configurationConditions,
  configurationPropertyLink,
} from './spring-configuration-conditions';
import type { ConfigurationBinding } from './spring-configuration-types';
import type { OutboundInput } from './spring-outbound-provenance';

const PROPERTIES = 'org.springframework.boot.context.properties.ConfigurationProperties';
const BEAN = 'org.springframework.context.annotation.Bean';

function literal(value: string | undefined): string | null {
  if (value === undefined || !/^"[^"\\]*"$/u.test(value)) return null;
  return value.slice(1, -1);
}

function propertyKey(prefix: string, name: string): string {
  const kebab = name.replaceAll(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
  return `${prefix}.${kebab}`;
}

function factory(
  input: OutboundInput,
  context: { readonly unit: JavaUnit; readonly method: JavaMethod; readonly owner: JavaType },
  type: JavaType,
): ConfigurationBinding['factories'] {
  const { unit, method, owner } = context;
  const annotation = method.annotations.find((entry) => entry.name === BEAN);
  const parameter = method.parameters.find(
    (entry) => resolveJavaType(entry.type, unit) === type.qualifiedName,
  );
  const keys = new Set(
    type.fields.map((field) => propertyKey(propertyPrefix(type) ?? '', field.name)),
  );
  const linked =
    parameter !== undefined ||
    configurationPropertyLink(owner, keys) ||
    configurationPropertyLink(method, keys);
  if (!annotation || !linked) return [];
  return [
    {
      source: method.source,
      name: literal(annotation.arguments.value) ?? method.name,
      return_type: method.returnType,
      parameter_sources: method.parameters.map((entry) => entry.source),
      call_binding_ids: input.calls
        .filter((call) => call.caller === method.source)
        .map((call) => call.id),
    },
  ];
}

function factories(input: OutboundInput, type: JavaType): ConfigurationBinding['factories'] {
  const result: ConfigurationBinding['factories'][number][] = [];
  for (const unit of input.units) {
    for (const owner of unit.types) {
      for (const method of owner.methods) {
        result.push(...factory(input, { unit, method, owner }, type));
      }
    }
  }
  return result;
}

function propertyPrefix(type: JavaType): string | null {
  const annotation = type.annotations.find((entry) => entry.name === PROPERTIES);
  return annotation ? literal(annotation.arguments.prefix ?? annotation.arguments.value) : null;
}

function linkedConditions(
  input: OutboundInput,
  type: JavaType,
  selected: ConfigurationBinding['factories'],
): ConfigurationBinding['conditions'] {
  const ids = new Set(selected.map((entry) => entry.source));
  const result = [...configurationConditions(type)];
  for (const unit of input.units) {
    for (const owner of unit.types) {
      const methods = owner.methods.filter((method) => ids.has(method.source));
      if (methods.length > 0) result.push(...configurationConditions(owner));
      for (const method of methods) result.push(...configurationConditions(method));
    }
  }
  return [...new Map(result.map((condition) => [condition.source, condition])).values()];
}

function binding(
  input: OutboundInput,
  unit: JavaUnit,
  type: JavaType,
): ConfigurationBinding | null {
  const prefix = propertyPrefix(type);
  if (prefix === null || !`/${unit.path}`.includes('/src/main/')) return null;
  const properties: ConfigurationBinding['properties'] = type.fields.map((field) => ({
    key: propertyKey(prefix, field.name),
    value: null,
    value_kind: 'declaration',
    type: field.type,
    source: field.source,
    placeholders: [],
  }));
  const selectors = input.calls.flatMap((call) => {
    if (
      type.kind !== 'record' ||
      call.receiverType !== type.qualifiedName ||
      call.argumentTypes.length > 0
    ) {
      return [];
    }
    if (type.methods.some((method) => method.name === call.methodName)) return [];
    const field = type.fields.find((entry) => entry.name === call.methodName);
    return field
      ? [
          {
            source: call.call,
            receiver_type: call.receiverType,
            operation: call.methodName,
            property_key: propertyKey(prefix, field.name),
            property_source: field.source,
          },
        ]
      : [];
  });
  const candidates = factories(input, type);
  return {
    kind: 'configuration_binding',
    id: `configuration:${type.source}`,
    source: type.source,
    format: 'java_properties',
    declared_type: type.qualifiedName,
    prefix,
    profile: null,
    properties,
    selectors,
    factories: candidates,
    conditions: linkedConditions(input, type, candidates),
    completeness: 'partial',
    gaps: [
      'Declared property keys and typed selectors are source candidates. Effective binding, bean selection, profiles, external overrides and environment values remain unobserved.',
    ],
  };
}

/** Exact framework annotations and nominal receiver types establish property selectors. */
export function collectConfigurationBindings(
  input: OutboundInput,
): readonly ConfigurationBinding[] {
  return input.units.flatMap((unit) =>
    unit.types.flatMap((type) => {
      const result = binding(input, unit, type);
      return result ? [result] : [];
    }),
  );
}
