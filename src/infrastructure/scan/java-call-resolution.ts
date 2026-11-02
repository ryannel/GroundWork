import 'server-only';

import type { JavaBindingContext, JavaCallSite, JavaMethodTarget } from './java-call-binding-types';
import { specialiseJavaMethod } from './java-call-generic';
import { javaStreamLambdaType } from './java-call-lambda';
import { javaRecordAccessor } from './java-call-record';
import { javaDeclaredType, javaField, javaOwner, javaVariable } from './java-call-syntax';
import { javaMethods, javaTypeName } from './java-call-types';
import { declarationSource, declarationText } from './java-declaration-parts';
import type { SyntaxNode } from './source-index-types';

const LITERALS: Readonly<Record<string, string>> = {
  STRING_LITERAL: 'java.lang.String',
  BOOLEAN_LITERAL: 'boolean',
  INT_LITERAL: 'int',
  LONG_LITERAL: 'long',
  DOUBLE_LITERAL: 'double',
  FLOAT_LITERAL: 'float',
  CHAR_LITERAL: 'char',
};
const PRIMITIVES = new Set([
  'boolean',
  'int',
  'long',
  'double',
  'float',
  'char',
  'byte',
  'short',
  'void',
]);
function ownerType(context: JavaBindingContext, node: SyntaxNode): string | null {
  const owner = javaOwner(context.index, node);
  return (
    context.unit.types.find(
      (type) => type.source === (owner && declarationSource(context.index, owner)),
    )?.qualifiedName ?? null
  );
}
function memberType(context: JavaBindingContext, node: SyntaxNode, depth: number): string | null {
  const receiver = javaField(context.index, node, 'receiver');
  if (!receiver) return null;
  const receiverType = javaExpressionType(context, receiver, depth + 1);
  const owner = context.units
    .flatMap((unit) => unit.types)
    .find((type) => type.qualifiedName === receiverType);
  const field = owner?.fields.find((entry) => entry.name === node.symbol);
  const unit = context.units.find((entry) => owner !== undefined && entry.types.includes(owner));
  return field && unit ? javaTypeName(field.type, unit) : null;
}
function constructedType(context: JavaBindingContext, node: SyntaxNode): string | null {
  const field = node.kind === 'NEW_CLASS' ? 'callee' : 'type';
  if (!['NEW_CLASS', 'TYPE_CAST'].includes(node.kind)) return null;
  const name = declarationText(context.index, node, field)[0];
  return name === undefined || name.trim() === '' ? null : javaTypeName(name, context.unit);
}
function invocationReturnType(
  context: JavaBindingContext,
  node: SyntaxNode,
  depth: number,
): string | null {
  const site = javaCallSite(context, node, depth + 1);
  return (
    javaCallTarget(context, site, depth + 1)?.returnType ??
    javaRecordAccessor(context, site)?.returnType ??
    collectionFactoryType(context, site, depth + 1)
  );
}
function collectionFactoryType(
  context: JavaBindingContext,
  site: JavaCallSite,
  depth: number,
): string | null {
  if (site.methodName !== 'of' || !site.receiver || javaVariable(context, site.receiver) !== null) {
    return null;
  }
  if (javaTypeName(site.receiver.text, context.unit) !== 'java.util.Set') return null;
  const argumentsTypes = site.arguments.map((node) => javaExpressionType(context, node, depth + 1));
  const type = argumentsTypes[0];
  if (type !== 'java.lang.String' || !argumentsTypes.every((actual) => actual === type)) {
    return null;
  }
  return `java.util.Set<${type}>`;
}

export function javaExpressionType(
  context: JavaBindingContext,
  node: SyntaxNode,
  depth = 0,
): string | null {
  const type = expressionType(context, node, depth);
  return type === null || type.trim() === '' ? null : type;
}
function expressionType(context: JavaBindingContext, node: SyntaxNode, depth = 0): string | null {
  if (depth > 20) return null;
  const literal = LITERALS[node.kind];
  if (literal !== undefined) return literal;
  if (node.text === 'this') return ownerType(context, node);
  const declared = javaDeclaredType(context, node);
  if (declared === 'var' || declared === '') return null;
  if (declared !== null) return javaTypeName(declared, context.unit);
  const lambdaType = javaStreamLambdaType(context, node, (collection) =>
    javaExpressionType(context, collection, depth + 1),
  );
  if (lambdaType !== null) return lambdaType;
  return undeclaredExpressionType(context, node, depth);
}
function undeclaredExpressionType(
  context: JavaBindingContext,
  node: SyntaxNode,
  depth: number,
): string | null {
  if (node.kind === 'MEMBER_SELECT') return memberType(context, node, depth);
  if (node.kind === 'METHOD_INVOCATION') return invocationReturnType(context, node, depth);
  const constructed = constructedType(context, node);
  if (constructed !== null) return constructed;
  const grouped = javaField(context.index, node, 'expression');
  return grouped ? javaExpressionType(context, grouped, depth + 1) : null;
}
function shadowedQualifier(context: JavaBindingContext, node: SyntaxNode, depth = 0): boolean {
  if (depth > 20) return true;
  const receiver = javaField(context.index, node, 'receiver');
  return receiver
    ? shadowedQualifier(context, receiver, depth + 1)
    : javaVariable(context, node) !== null;
}
function invocationReceiverType(
  context: JavaBindingContext,
  site: { readonly node: SyntaxNode; readonly receiver: SyntaxNode | null },
  depth: number,
): string | null {
  if (!site.receiver) return ownerType(context, site.node);
  const expression = javaExpressionType(context, site.receiver, depth + 1);
  if (expression !== null || shadowedQualifier(context, site.receiver)) return expression;
  const nominal = javaTypeName(site.receiver.text, context.unit);
  return ['java.util.List', 'java.util.Set'].includes(nominal) ? nominal : null;
}
function invocationName(node: SyntaxNode, callee: SyntaxNode | null): string {
  if (node.kind === 'NEW_CLASS') return '<init>';
  return callee?.symbol === '' ? callee.text : (callee?.symbol ?? callee?.text ?? '');
}
export function javaCallSite(
  context: JavaBindingContext,
  node: SyntaxNode,
  depth = 0,
): JavaCallSite {
  const callee = javaField(context.index, node, 'callee');
  const receiver = callee && javaField(context.index, callee, 'receiver');
  const receiverType =
    node.kind === 'NEW_CLASS'
      ? constructedType(context, node)
      : invocationReceiverType(context, { node, receiver }, depth);
  return {
    node,
    receiver,
    receiverType,
    methodName: invocationName(node, callee),
    arguments: (node.fields?.arguments ?? []).flatMap(([start, end]) => {
      const match = context.index.nodes.find((entry) => entry.start === start && entry.end === end);
      return match ? [match] : [];
    }),
  };
}
function compatible(context: JavaBindingContext, actual: string | null, formal: string): boolean {
  if (actual === null) return false;
  if (actual === formal) return true;
  // Preserve Java's nominal inheritance only when both declarations are indexed.
  const unit = context.units.find((entry) =>
    entry.types.some((type) => type.qualifiedName === actual),
  );
  const owner = unit?.types.find((type) => type.qualifiedName === actual);
  return (
    unit !== undefined &&
    owner !== undefined &&
    [...owner.extends, ...owner.implements].some((type) => javaTypeName(type, unit) === formal)
  );
}
export function javaCallTarget(
  context: JavaBindingContext,
  site: JavaCallSite,
  depth = 0,
): JavaMethodTarget | null {
  if (depth > 20 || site.receiverType === null) return null;
  const actualTypes = site.arguments.map((node) => javaExpressionType(context, node, depth + 1));
  const candidates = javaMethods(context, site.receiverType).flatMap((target) => {
    const specialised = specialiseJavaMethod(target, actualTypes);
    return specialised ? [specialised] : [];
  });
  const matches = candidates.filter(
    (target) =>
      target.method.name === site.methodName &&
      target.parameters.length === actualTypes.length &&
      target.parameters.every((formal, position) => {
        if (site.arguments[position]?.kind === 'NULL_LITERAL') return !PRIMITIVES.has(formal);
        return compatible(context, actualTypes[position] ?? null, formal);
      }),
  );
  const exact = matches.filter((target) =>
    target.parameters.every((formal, position) => formal === actualTypes[position]),
  );
  if (exact.length === 1) return exact[0] ?? null;
  return matches.length === 1 ? (matches[0] ?? null) : null;
}
