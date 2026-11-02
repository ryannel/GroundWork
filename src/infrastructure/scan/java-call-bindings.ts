import 'server-only';

import type { CallBinding, JavaBindingContext, ValueBinding } from './java-call-binding-types';
import { javaCallSite, javaCallTarget, javaExpressionType } from './java-call-resolution';
import { javaGuards, javaMethod } from './java-call-syntax';
import { declarationSource } from './java-declaration-parts';
import type { JavaUnit } from './java-declarations';
import { javaValues } from './java-value-bindings';
import type { SourceIndex, SyntaxNode } from './source-index-types';

function callBinding(context: JavaBindingContext, node: SyntaxNode): CallBinding {
  const site = javaCallSite(context, node);
  const declaration = javaCallTarget(context, site);
  const target = declaration?.method.body === null ? null : declaration;
  const source = declarationSource(context.index, node);
  const caller = javaMethod(context.index, node);
  return {
    kind: 'java_call_binding',
    id: `java-call:${source}`,
    call: source,
    caller: caller ? declarationSource(context.index, caller) : null,
    receiver: site.receiver ? declarationSource(context.index, site.receiver) : null,
    receiverType: site.receiverType,
    methodName: site.methodName,
    argumentTypes: site.arguments.map((argument) => javaExpressionType(context, argument)),
    target: target?.method.source ?? null,
    signature: target
      ? `${target.owner.qualifiedName}#${target.method.name}(${target.parameters.join(',')}):${target.returnType}`
      : null,
    resolution: target ? 'exact' : 'unresolved',
    reason: target
      ? 'Unique indexed nominal receiver and compatible complete parameter types.'
      : 'Receiver, argument types, executable body or unique compatible indexed declaration unavailable.',
    guards: javaGuards(context.index, node),
  };
}
/** Source-declared dispatch and value links; unresolved library and dynamic dispatch remain explicit. */
export function collectJavaBindings(
  indexes: readonly SourceIndex[],
  units: readonly JavaUnit[],
): {
  readonly calls: readonly CallBinding[];
  readonly values: readonly ValueBinding[];
} {
  const contexts = indexes
    .filter((index) => index.language === 'java' && index.diagnostics.length === 0)
    .flatMap((index) => {
      const unit = units.find((entry) => entry.path === index.path);
      return unit ? [{ index, unit, units }] : [];
    });
  const calls = contexts.flatMap((context) =>
    context.index.nodes
      .filter((node) => ['METHOD_INVOCATION', 'NEW_CLASS'].includes(node.kind))
      .map((node) => callBinding(context, node)),
  );
  return { calls, values: javaValues(contexts, calls) };
}
