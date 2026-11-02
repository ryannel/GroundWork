import 'server-only';

import type { JavaMethodTarget } from './java-call-binding-types';
import { javaTypeName } from './java-call-types';

const PRIMITIVE = new Set([
  'int',
  'long',
  'double',
  'float',
  'char',
  'byte',
  'short',
  'boolean',
  'void',
]);

/** Infer only bare, unbounded method type variables with one consistent known nominal actual. */
export function specialiseJavaMethod(
  target: JavaMethodTarget,
  actuals: readonly (string | null)[],
): JavaMethodTarget | null {
  if ((target.method.boundedTypeParameters ?? []).length > 0) return null;
  const variables = (target.method.typeParameters ?? []).map((name) =>
    javaTypeName(name, target.unit),
  );
  if (variables.length === 0) return target;
  const substitutions = new Map<string, string>();
  for (const variable of variables) {
    const inferred = target.parameters.flatMap((formal, position) =>
      formal === variable ? [actuals[position] ?? null] : [],
    );
    const first = inferred[0];
    if (
      first === null ||
      first === undefined ||
      PRIMITIVE.has(first) ||
      inferred.some((actual) => actual !== first)
    ) {
      return null;
    }
    substitutions.set(variable, first);
  }
  const replace = (value: string): string =>
    value.replaceAll(
      /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/gu,
      (name) => substitutions.get(name) ?? name,
    );
  return {
    ...target,
    parameters: target.parameters.map(replace),
    returnType: replace(target.returnType),
  };
}
