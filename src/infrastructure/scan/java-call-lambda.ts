import 'server-only';

import type { JavaBindingContext } from './java-call-binding-types';
import { javaField, javaVariable } from './java-call-syntax';
import { javaTypeParts } from './java-call-types';
import { declarationChildren } from './java-declaration-parts';
import type { SourceIndex, SyntaxNode } from './source-index-types';

/** Static collection element upper bound only; this establishes neither iteration nor scheduling. */
export function javaStreamLambdaType(
  context: JavaBindingContext,
  node: SyntaxNode,
  expressionType: (node: SyntaxNode) => string | null,
): string | null {
  const call = lambdaCall(context, node);
  const collection = call && mappedCollection(context.index, call);
  const type = collection ? expressionType(collection) : null;
  return type === null ? null : elementUpperBound(type);
}
function lambdaCall(context: JavaBindingContext, node: SyntaxNode): SyntaxNode | null {
  const { index } = context;
  const variable = javaVariable(context, node);
  const lambda = parentNode(index, variable);
  if (
    lambda?.kind !== 'LAMBDA_EXPRESSION' ||
    declarationChildren(index, lambda, 'parameters').length !== 1
  ) {
    return null;
  }
  const call = parentNode(index, lambda);
  if (call?.kind !== 'METHOD_INVOCATION') return null;
  const argumentsList = declarationChildren(index, call, 'arguments');
  if (argumentsList.length !== 1 || !argumentsList.includes(lambda)) return null;
  return call;
}
function parentNode(
  index: SourceIndex,
  node: SyntaxNode | null | undefined,
): SyntaxNode | undefined {
  if (node?.parent === null || node?.parent === undefined) return undefined;
  return index.nodes[node.parent];
}

function mappedCollection(index: SourceIndex, call: SyntaxNode): SyntaxNode | null {
  const callee = javaField(index, call, 'callee');
  const receiver = callee && javaField(index, callee, 'receiver');
  if (!receiver) return null;
  if (callee.symbol === 'forEach') return streamedCollection(index, receiver) ?? receiver;
  return callee.symbol === 'map' ? streamedCollection(index, receiver) : null;
}
function streamedCollection(index: SourceIndex, stream: SyntaxNode): SyntaxNode | null {
  if (
    stream.kind !== 'METHOD_INVOCATION' ||
    declarationChildren(index, stream, 'arguments').length > 0
  ) {
    return null;
  }
  const streamCallee = javaField(index, stream, 'callee');
  const collection = streamCallee && javaField(index, streamCallee, 'receiver');
  if (streamCallee?.symbol !== 'stream' || !collection) return null;
  return collection;
}
function elementUpperBound(type: string): string | null {
  const parts = javaTypeParts(type);
  if (
    !['java.util.List', 'java.util.Set', 'java.util.Collection'].includes(parts.base) ||
    parts.arguments.length !== 1
  ) {
    return null;
  }
  const element = parts.arguments[0];
  if (element === undefined || element === '' || element.includes('?super') || element === '?') {
    return null;
  }
  return element.startsWith('?extends') ? element.slice('?extends'.length) : element;
}
