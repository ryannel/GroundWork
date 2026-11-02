import 'server-only';

import type { JavaBindingContext } from './java-call-binding-types';
import { javaExpressionType } from './java-call-resolution';
import { javaAncestors, javaField, javaGuards, javaVariable } from './java-call-syntax';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { SyntaxNode } from './source-index-types';
import { outboundLiteral, outboundName } from './spring-outbound-syntax';
import type { OutboundBinding } from './spring-outbound-types';

function unwrapGraphFactory(
  context: JavaBindingContext,
  origin: SyntaxNode,
): SyntaxNode | undefined {
  const factory = javaField(context.index, origin, 'callee');
  const receiver = factory && javaField(context.index, factory, 'receiver');
  const imported = context.unit.imports.includes(
    'org.springframework.graphql.client.HttpSyncGraphQlClient',
  );
  const staticFactory =
    receiver?.text === 'HttpSyncGraphQlClient' && javaVariable(context, receiver) === null;
  if (
    staticFactory &&
    imported &&
    origin.kind === 'METHOD_INVOCATION' &&
    outboundName(context.index, origin) === 'create'
  ) {
    return declarationChildren(context.index, origin, 'arguments')[0];
  }
  return origin;
}

function registryOrigin(context: JavaBindingContext, variable: SyntaxNode): SyntaxNode | null {
  const { index } = context;
  const assignments = index.nodes.filter(
    (node) =>
      node.kind === 'ASSIGNMENT' &&
      declarationChildren(index, node, 'targets').some(
        (target) => javaVariable(context, target) === variable,
      ),
  );
  const origins = [
    ...declarationChildren(index, variable, 'values'),
    ...assignments.flatMap((node) => declarationChildren(index, node, 'values')),
  ];
  const origin = origins.length === 1 ? origins[0] : undefined;
  const call = origin && unwrapGraphFactory(context, origin);
  if (call?.kind !== 'METHOD_INVOCATION' || outboundName(index, call) !== 'getClient') {
    return null;
  }
  const callee = javaField(index, call, 'callee');
  const receiver = callee && javaField(index, callee, 'receiver');
  if (
    !receiver ||
    javaExpressionType(context, receiver) !== 'com.volvocars.ecom.restclient.RestClientRegistry'
  ) {
    return null;
  }
  const deferred = javaAncestors(index, call).some((node) => node.kind === 'LAMBDA_EXPRESSION');
  return javaGuards(index, call).length === 0 && !deferred ? call : null;
}

/** Library registry calls identify a logical client; they do not establish its deployed address. */
export function outboundClient(
  context: JavaBindingContext,
  receiver: SyntaxNode,
): OutboundBinding['client'] {
  const variable = javaVariable(context, receiver);
  const call = variable === null ? null : registryOrigin(context, variable);
  const argument = call && declarationChildren(context.index, call, 'arguments')[0];
  return {
    type: javaExpressionType(context, receiver) ?? '',
    receiver_source: declarationSource(context.index, receiver),
    logical_name: call === null ? null : outboundLiteral(context, argument ?? undefined),
    registry_source: call === null ? null : declarationSource(context.index, call),
  };
}
