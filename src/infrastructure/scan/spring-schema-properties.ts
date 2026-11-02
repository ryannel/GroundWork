import 'server-only';

import type { JavaAnnotation, JavaField, JavaType } from './java-declarations';
import {
  annotationName,
  springConstraints,
  springJsonIgnored,
  springJsonName,
  springViews,
  type SpringConstraint,
} from './spring-schema-annotations';

export interface SpringDeclaredProperty {
  readonly name: string;
  readonly jsonName: string;
  readonly type: string;
  readonly source: string;
  readonly constraints: readonly SpringConstraint[];
  readonly views: readonly string[];
  readonly presence: 'unknown';
  readonly nullable: 'unknown';
  readonly access: 'declared_field' | 'declared_getter';
  readonly annotations: readonly JavaAnnotation[];
}

function property(
  field: Pick<JavaField, 'name' | 'type' | 'source' | 'annotations'>,
  access: SpringDeclaredProperty['access'],
): SpringDeclaredProperty {
  return {
    name: field.name,
    jsonName: springJsonName(field.name, field.annotations),
    type: field.type,
    source: field.source,
    constraints: springConstraints(field.annotations),
    views: springViews(field.annotations),
    presence: 'unknown',
    nullable: 'unknown',
    access,
    annotations: field.annotations,
  };
}

function getterName(name: string): string | undefined {
  let prefix = 0;
  if (name.startsWith('get')) prefix = 3;
  if (name.startsWith('is')) prefix = 2;
  const suffix = name.slice(prefix);
  return prefix > 0 && suffix.length > 0
    ? suffix.charAt(0).toLowerCase() + suffix.slice(1)
    : undefined;
}

/** Fields and source accessors remain declarations; ObjectMapper visibility is a separate gap. */
export function springDeclaredProperties(type: JavaType): readonly SpringDeclaredProperty[] {
  const fields = type.fields.filter(
    (field) => !field.modifiers.includes('static') && !springJsonIgnored(field.annotations),
  );
  const properties = fields.map((field) => property(field, 'declared_field'));
  const methods = type.methods.filter(
    (method) => method.parameters.length === 0 && method.returnType !== 'void',
  );
  for (const method of methods) {
    const name = getterName(method.name);
    if (name === undefined) continue;
    const existing = properties.findIndex((candidate) => candidate.name === name);
    if (springJsonIgnored(method.annotations) && existing !== -1) properties.splice(existing, 1);
    if (!springJsonIgnored(method.annotations)) {
      const previous = properties[existing];
      const annotations = [...(previous?.annotations ?? []), ...method.annotations];
      const declaration = property(
        { name, type: method.returnType, source: method.source, annotations },
        'declared_getter',
      );
      if (previous) properties[existing] = declaration;
      else properties.push(declaration);
    }
  }
  return properties;
}

export function springLombokAccessors(type: JavaType): readonly string[] {
  return type.annotations
    .filter((annotation) =>
      [
        'Data',
        'Value',
        'Getter',
        'Setter',
        'Builder',
        'NoArgsConstructor',
        'AllArgsConstructor',
        'RequiredArgsConstructor',
      ].includes(annotationName(annotation)),
    )
    .map((annotation) => annotation.name);
}
