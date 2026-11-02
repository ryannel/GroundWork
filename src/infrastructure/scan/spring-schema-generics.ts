import 'server-only';

import type { JavaType } from './java-declarations';
import { springTypeReference, type SpringTypeReference } from './spring-schema-types';

function substituted(
  reference: SpringTypeReference,
  argumentsByName: ReadonlyMap<string, string>,
): string {
  const annotations = reference.annotations.map((name) => `@${name} `).join('');
  const element = reference.arguments[0];
  if (reference.name === 'array' && element) {
    return `${annotations}${substituted(element, argumentsByName)}[]`;
  }
  const name = argumentsByName.get(reference.name) ?? reference.name;
  const typeArguments = reference.arguments.map((argument) =>
    substituted(argument, argumentsByName),
  );
  const parameters = typeArguments.length > 0 ? `<${typeArguments.join(', ')}>` : '';
  return `${annotations}${name}${parameters}`;
}

/** Substitution requires source-declared type parameters; arbitrary capital names are never guessed. */
export function springInstantiate(type: JavaType, expression: string): JavaType {
  const typeArguments = springTypeReference(expression).arguments;
  const bindings = new Map(
    (type.typeParameters ?? []).flatMap((name, position) => {
      const argument = typeArguments[position];
      return argument ? [[name, substituted(argument, new Map())]] : [];
    }),
  );
  if (bindings.size === 0) return type;
  const substitute = (name: string): string => substituted(springTypeReference(name), bindings);
  return {
    ...type,
    extends: type.extends.map(substitute),
    implements: type.implements.map(substitute),
    fields: type.fields.map((field) => ({ ...field, type: substitute(field.type) })),
    methods: type.methods.map((method) => ({
      ...method,
      returnType: substitute(method.returnType),
    })),
  };
}
