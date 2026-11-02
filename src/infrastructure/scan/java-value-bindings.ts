import 'server-only';

import type { CallBinding, JavaBindingContext, ValueBinding } from './java-call-binding-types';
import { javaRecordAccessor } from './java-call-record';
import { javaCallSite } from './java-call-resolution';
import { javaAncestors, javaField, javaGuards, javaMethod, javaVariable } from './java-call-syntax';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import { distinctJavaValues } from './java-value-identity';
import type { SourceIndex, SyntaxNode } from './source-index-types';

function javaValueBinding(
  index: SourceIndex,
  relation: ValueBinding['relation'],
  nodes: {
    readonly from: SyntaxNode;
    readonly to: SyntaxNode;
    readonly call?: SyntaxNode;
  },
): ValueBinding {
  const from = declarationSource(index, nodes.from);
  const to = declarationSource(index, nodes.to);
  const call = nodes.call ? declarationSource(index, nodes.call) : null;
  return {
    kind: 'java_value_binding',
    id: `java-value:${relation}:${from}:${to}:${call ?? ''}`,
    relation,
    from,
    to,
    call,
    guards: javaGuards(index, nodes.from),
  };
}
function recordProjection(context: JavaBindingContext, node: SyntaxNode): ValueBinding[] {
  const accessor = javaRecordAccessor(context, javaCallSite(context, node));
  if (!accessor) return [];
  const call = declarationSource(context.index, node);
  return [
    {
      kind: 'java_value_binding',
      id: `java-value:field_projection:${accessor.field.source}:${call}`,
      relation: 'field_projection',
      from: accessor.field.source,
      to: call,
      call,
      guards: javaGuards(context.index, node),
    },
  ];
}
function localValue(context: JavaBindingContext, node: SyntaxNode): ValueBinding[] {
  const { index } = context;
  if (
    node.kind === 'ASSIGNMENT' &&
    javaAncestors(index, node).some((ancestor) => ancestor.kind === 'ANNOTATION')
  ) {
    return [];
  }
  if (node.kind === 'METHOD_INVOCATION') return recordProjection(context, node);
  if (node.kind === 'IDENTIFIER' || node.kind === 'MEMBER_SELECT') {
    const variable = javaVariable(context, node);
    return variable ? [javaValueBinding(index, 'reference', { from: variable, to: node })] : [];
  }
  const value = javaField(index, node, 'values');
  if (!value) return [];
  if (node.kind === 'VARIABLE') {
    return [javaValueBinding(index, 'initializer', { from: value, to: node })];
  }
  const target = javaField(index, node, 'targets');
  return node.kind === 'ASSIGNMENT' && target
    ? [
        javaValueBinding(index, 'assignment', {
          from: value,
          to: javaVariable(context, target) ?? target,
        }),
      ]
    : [];
}
function callArguments(
  context: JavaBindingContext,
  call: CallBinding,
  targetContext: JavaBindingContext,
): ValueBinding[] {
  const node = context.index.nodes.find(
    (entry) => declarationSource(context.index, entry) === call.call,
  );
  const method = targetContext.index.nodes.find(
    (entry) => declarationSource(targetContext.index, entry) === call.target,
  );
  if (!node || !method) return [];
  const actualArguments = declarationChildren(context.index, node, 'arguments');
  return declarationChildren(targetContext.index, method, 'parameters').flatMap(
    (parameter, position) => {
      const argument = actualArguments[position];
      if (!argument) return [];
      const binding = javaValueBinding(context.index, 'argument_parameter', {
        from: argument,
        to: argument,
        call: node,
      });
      const to = declarationSource(targetContext.index, parameter);
      return [{ ...binding, id: `${binding.id}:${to}`, to }];
    },
  );
}
function callReturns(call: CallBinding, targetContext: JavaBindingContext): ValueBinding[] {
  const method = targetContext.index.nodes.find(
    (entry) => declarationSource(targetContext.index, entry) === call.target,
  );
  if (!method) return [];
  return targetContext.index.nodes
    .filter((node) => node.kind === 'RETURN' && javaMethod(targetContext.index, node) === method)
    .flatMap((node) =>
      declarationChildren(targetContext.index, node, 'values').map((value) => ({
        kind: 'java_value_binding' as const,
        id: `java-value:return_call:${declarationSource(targetContext.index, value)}:${call.call}`,
        relation: 'return_call' as const,
        from: declarationSource(targetContext.index, value),
        to: call.call,
        call: call.call,
        guards: javaGuards(targetContext.index, value),
      })),
    );
}
export function javaValues(
  contexts: readonly JavaBindingContext[],
  calls: readonly CallBinding[],
): ValueBinding[] {
  const values = contexts.flatMap((context) =>
    context.index.nodes.flatMap((node) => localValue(context, node)),
  );
  const sources = new Map(
    contexts.flatMap((context) =>
      context.index.nodes.map((node) => [declarationSource(context.index, node), context] as const),
    ),
  );
  for (const call of calls.filter((entry) => entry.resolution === 'exact')) {
    const context = sources.get(call.call);
    const targetContext = call.target === null ? undefined : sources.get(call.target);
    if (context && targetContext) {
      values.push(
        ...callArguments(context, call, targetContext),
        ...callReturns(call, targetContext),
      );
    }
  }
  return distinctJavaValues(values);
}
