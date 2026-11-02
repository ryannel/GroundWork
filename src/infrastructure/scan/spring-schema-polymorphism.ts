import 'server-only';

import type { JavaAnnotation } from './java-declarations';
import { springAnnotationValues, springLiteral } from './spring-route-values';
import { annotationClasses, annotationName } from './spring-schema-annotations';

export interface SpringPolymorphism {
  readonly strategy: string | null;
  readonly discriminator: string | null;
  readonly defaultType: string | null;
  readonly visible: string | null;
  readonly subtypes: readonly { readonly type: string; readonly name: string | null }[];
  readonly unresolved: readonly string[];
}

function subtype(expression: string): SpringPolymorphism['subtypes'][number] | undefined {
  const opening = expression.indexOf('(');
  if (opening === -1 || !expression.endsWith(')')) return undefined;
  const typeArguments = Object.fromEntries(
    springAnnotationValues(expression.slice(opening + 1, -1)).map((argument) => {
      const equals = argument.indexOf('=');
      return [argument.slice(0, equals).trim(), argument.slice(equals + 1).trim()];
    }),
  );
  const type = annotationClasses(typeArguments.value)[0];
  return type === undefined
    ? undefined
    : { type, name: springLiteral(typeArguments.name ?? '') ?? null };
}

export function springPolymorphism(
  annotations: readonly JavaAnnotation[],
): SpringPolymorphism | null {
  const info = annotations.find((annotation) => annotationName(annotation) === 'JsonTypeInfo');
  const declared = annotations.find((annotation) => annotationName(annotation) === 'JsonSubTypes');
  if (!info && !declared) return null;
  const raw = declared?.arguments.value?.trim() ?? '';
  const values = springAnnotationValues(raw.startsWith('{') ? raw.slice(1, -1) : raw);
  const subtypes = values.map(subtype);
  return {
    ...typeInfo(info),
    subtypes: subtypes.filter((value) => value !== undefined),
    unresolved: values.filter((_, position) => subtypes[position] === undefined),
  };
}

function typeInfo(
  info: JavaAnnotation | undefined,
): Pick<SpringPolymorphism, 'strategy' | 'discriminator' | 'defaultType' | 'visible'> {
  return {
    strategy: info?.arguments.use ?? null,
    discriminator: springLiteral(info?.arguments.property ?? '') ?? null,
    defaultType: annotationClasses(info?.arguments.defaultImpl)[0] ?? null,
    visible: info?.arguments.visible ?? null,
  };
}
