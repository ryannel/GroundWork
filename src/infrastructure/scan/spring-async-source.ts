import 'server-only';

import type { CallBinding } from './java-call-binding-types';
import { javaAncestors, javaField } from './java-call-syntax';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { JavaMethod } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import type { AsyncBinding } from './spring-async-types';
import type { OutboundInput } from './spring-outbound-provenance';

/** The nearest executable owner prevents deferred bodies leaking into their enclosing method. */
function asyncOwner(index: SourceIndex, node: SyntaxNode): SyntaxNode | undefined {
  return javaAncestors(index, node).find((ancestor) =>
    ['METHOD', 'LAMBDA_EXPRESSION', 'CLASS', 'INTERFACE', 'ENUM', 'RECORD'].includes(ancestor.kind),
  );
}

function asyncMethodNode(index: SourceIndex, method: JavaMethod): SyntaxNode | undefined {
  return index.nodes.find(
    (node) => node.kind === 'METHOD' && declarationSource(index, node) === method.source,
  );
}

export function asyncOwnedNodes(index: SourceIndex, method: JavaMethod): readonly SyntaxNode[] {
  const node = asyncMethodNode(index, method);
  return node ? index.nodes.filter((candidate) => asyncOwner(index, candidate) === node) : [];
}

const RESULT_USE: Readonly<Record<string, 'ignored' | 'returned' | 'bound'>> = {
  EXPRESSION_STATEMENT: 'ignored',
  RETURN: 'returned',
  VARIABLE: 'bound',
  ASSIGNMENT: 'bound',
};

export function asyncCallUse(
  index: SourceIndex,
  node: SyntaxNode,
  future = false,
): Pick<AsyncBinding['invocations'][number], 'use' | 'use_source'> {
  let value = node;
  let parent = node.parent === null ? undefined : index.nodes[node.parent];
  while (parent?.kind === 'PARENTHESIZED') {
    value = parent;
    parent = parent.parent === null ? undefined : index.nodes[parent.parent];
  }
  const useSource = declarationSource(index, parent ?? value);
  const known = parent === undefined ? undefined : RESULT_USE[parent.kind];
  if (known !== undefined) return { use: known, use_source: useSource };
  return {
    use: future && isImmediateJoin(index, parent, value) ? 'joined' : 'unknown',
    use_source: useSource,
  };
}

function isImmediateJoin(index: SourceIndex, parent: SyntaxNode | undefined, value: SyntaxNode) {
  if (parent?.kind !== 'MEMBER_SELECT' || parent.symbol !== 'join' || parent.parent === null) {
    return false;
  }
  const invocation = index.nodes[parent.parent];
  return (
    invocation?.kind === 'METHOD_INVOCATION' &&
    javaField(index, invocation, 'callee') === parent &&
    javaField(index, parent, 'receiver') === value &&
    declarationChildren(index, invocation, 'arguments').length === 0
  );
}

export function asyncInvocation(
  input: OutboundInput,
  binding: CallBinding,
): AsyncBinding['invocations'][number] | null {
  const index = input.indexes.find((candidate) =>
    candidate.nodes.some((node) => declarationSource(candidate, node) === binding.call),
  );
  const node = index?.nodes.find(
    (candidate) => declarationSource(index, candidate) === binding.call,
  );
  if (!index || !node) return null;
  const owner = asyncOwner(index, node);
  const callee = javaField(index, node, 'callee');
  const receiver = callee && javaField(index, callee, 'receiver');
  const direct = !receiver || ['this', 'super'].includes(receiver.text);
  return {
    call_source: binding.call,
    owner_source: owner ? declarationSource(index, owner) : null,
    call_binding_id: binding.id,
    dispatch: direct ? 'direct_self' : 'receiver_proxy_unverified',
    ...asyncCallUse(index, node, asyncFutureCall(input, binding)),
  };
}

/** Only an exactly resolved source declaration with the JDK future type supports join observation. */
export function asyncFutureCall(input: OutboundInput, binding: CallBinding): boolean {
  if (binding.resolution !== 'exact') return false;
  for (const unit of input.units) {
    const method = unit.types
      .flatMap((type) => type.methods)
      .find((candidate) => candidate.source === binding.target);
    if (!method) continue;
    const base = method.returnType.split('<')[0] ?? '';
    const type = unit.imports.find((entry) => entry.endsWith(`.${base}`)) ?? base;
    return type === 'java.util.concurrent.CompletableFuture';
  }
  return false;
}
