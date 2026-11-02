import 'server-only';

import type { JavaBindingContext } from './java-call-binding-types';
import { javaField, javaVariable } from './java-call-syntax';
import { declarationChildren, declarationSource, declarationText } from './java-declaration-parts';
import { resolveJavaType } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import { springLiteral } from './spring-route-values';

export function outboundName(index: SourceIndex, node: SyntaxNode): string {
  const callee = javaField(index, node, 'callee');
  return callee?.symbol ?? '';
}

export function outboundChain(index: SourceIndex, node: SyntaxNode): readonly SyntaxNode[] {
  if (node.kind !== 'METHOD_INVOCATION') return [];
  const callee = javaField(index, node, 'callee');
  const receiver = callee && javaField(index, callee, 'receiver');
  return [...(receiver ? outboundChain(index, receiver) : []), node];
}

export function outboundLiteral(
  context: JavaBindingContext,
  node: SyntaxNode | undefined,
): string | null {
  if (!node) return null;
  if (node.kind === 'STRING_LITERAL') {
    return springLiteral(context.index.content.slice(node.start, node.end)) ?? null;
  }
  const variable = javaVariable(context, node);
  if (variable?.modifiers?.includes('final') !== true) return null;
  const value = javaField(context.index, variable, 'values');
  return value?.kind === 'STRING_LITERAL'
    ? (springLiteral(context.index.content.slice(value.start, value.end)) ?? null)
    : null;
}

export function outboundClass(
  context: JavaBindingContext,
  node: SyntaxNode | undefined,
): string | null {
  if (node?.kind !== 'MEMBER_SELECT' || node.symbol !== 'class') return null;
  const type = declarationText(context.index, node, 'receiver')[0];
  return type === undefined ? null : resolveJavaType(type, context.unit);
}

export function outboundArguments(index: SourceIndex, node: SyntaxNode): readonly string[] {
  return declarationChildren(index, node, 'arguments').map((argument) =>
    declarationSource(index, argument),
  );
}
