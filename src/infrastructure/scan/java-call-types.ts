import 'server-only';

import type { JavaBindingContext, JavaMethodTarget } from './java-call-binding-types';
import type { JavaType, JavaUnit } from './java-declarations';

const JAVA_LANG = new Set([
  'String',
  'Object',
  'Boolean',
  'Integer',
  'Long',
  'Double',
  'Float',
  'Character',
  'Byte',
  'Short',
  'RuntimeException',
  'Exception',
  'Throwable',
  'Class',
  'Void',
]);
const PRIMITIVES = new Set([
  'void',
  'boolean',
  'int',
  'long',
  'double',
  'float',
  'char',
  'byte',
  'short',
]);

export function javaTypeName(name: string, unit: JavaUnit): string {
  return name
    .replaceAll(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/gu, (part) => {
      if (PRIMITIVES.has(part) || ['extends', 'super'].includes(part)) return part;
      if (part.includes('.') && /^[a-z]/u.test(part)) return part;
      const imported = unit.imports.find((entry) => entry.endsWith(`.${part.split('.')[0] ?? ''}`));
      if (imported !== undefined) return imported + part.slice((part.split('.')[0] ?? '').length);
      if (JAVA_LANG.has(part)) return `java.lang.${part}`;
      const local = unit.types.find((type) => type.name === part);
      return local?.qualifiedName ?? `${unit.packageName}.${part}`;
    })
    .replaceAll(/\s+/gu, '');
}
export function javaTypeParts(type: string): {
  readonly base: string;
  readonly arguments: readonly string[];
} {
  const start = type.indexOf('<');
  if (start === -1) return { base: type, arguments: [] };
  const typeArguments: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of type.slice(start + 1, -1)) {
    if (character === ',' && depth === 0) {
      typeArguments.push(current);
      current = '';
      continue;
    }
    if (character === '<') depth += 1;
    if (character === '>') depth -= 1;
    current += character;
  }
  if (current !== '') typeArguments.push(current);
  return { base: type.slice(0, start), arguments: typeArguments };
}
function substitute(type: string, substitutions: ReadonlyMap<string, string>): string {
  return type.replaceAll(/\b[A-Za-z_$][\w$]*\b/gu, (name) => substitutions.get(name) ?? name);
}
function methodSubstitutions(
  method: JavaType['methods'][number],
  substitutions: ReadonlyMap<string, string>,
): ReadonlyMap<string, string> {
  return new Map(
    [...substitutions].filter(([name]) => !(method.typeParameters ?? []).includes(name)),
  );
}
function declaredMethods(
  unit: JavaUnit,
  owner: JavaType,
  substitutions: ReadonlyMap<string, string>,
): JavaMethodTarget[] {
  return owner.methods.map((method) => ({
    unit,
    owner,
    method,
    parameters: method.parameters.map((parameter) =>
      javaTypeName(substitute(parameter.type, methodSubstitutions(method, substitutions)), unit),
    ),
    returnType: javaTypeName(
      substitute(method.returnType, methodSubstitutions(method, substitutions)),
      unit,
    ),
  }));
}
export function javaMethods(
  context: JavaBindingContext,
  receiverType: string,
  seen: readonly string[] = [],
): JavaMethodTarget[] {
  const parts = javaTypeParts(receiverType);
  if (seen.includes(parts.base)) return [];
  const unit = context.units.find((entry) =>
    entry.types.some((type) => type.qualifiedName === parts.base),
  );
  const owner = unit?.types.find((type) => type.qualifiedName === parts.base);
  if (!unit || !owner) return [];
  const substitutions = new Map(
    (owner.typeParameters ?? []).map((name, position) => [name, parts.arguments[position] ?? name]),
  );
  const own = declaredMethods(unit, owner, substitutions);
  const inherited = [...owner.extends, ...owner.implements].flatMap((parent) =>
    javaMethods(context, javaTypeName(substitute(parent, substitutions), unit), [
      ...seen,
      parts.base,
    ]),
  );
  return [
    ...own,
    ...inherited.filter(
      (parent) =>
        !own.some(
          (child) =>
            child.method.name === parent.method.name &&
            child.parameters.join(',') === parent.parameters.join(','),
        ),
    ),
  ];
}
