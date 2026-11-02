import 'server-only';

import type { JavaBindingContext } from './java-call-binding-types';
import { javaExpressionType } from './java-call-resolution';
import { javaField, javaMethod } from './java-call-syntax';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { SyntaxNode } from './source-index-types';
import type { GraphqlBinding, LibraryBinding } from './spring-client-boundary-types';
import { collectGraphqlBindings } from './spring-graphql-bindings';
import { collectLibraryBindings } from './spring-library-bindings';
import { outboundClient } from './spring-outbound-client';
import {
  outboundFailures,
  outboundProvenance,
  type OutboundInput,
} from './spring-outbound-provenance';
import {
  outboundArguments,
  outboundChain,
  outboundClass,
  outboundLiteral,
  outboundName,
} from './spring-outbound-syntax';
import type { OutboundBinding } from './spring-outbound-types';

function makeBinding(
  context: JavaBindingContext,
  chain: readonly SyntaxNode[],
  input: OutboundInput,
): OutboundBinding | null {
  const first = chain[0];
  const terminal = chain.at(-1);
  const method = terminal && javaMethod(context.index, terminal);
  const callee = first && javaField(context.index, first, 'callee');
  const receiver = callee && javaField(context.index, callee, 'receiver');
  if (!first || !terminal || !method || !receiver) return null;
  if (javaExpressionType(context, receiver) !== 'org.springframework.web.client.RestClient') {
    return null;
  }
  const verb = outboundName(context.index, first);
  if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(verb)) return null;
  const uri = chain.find((node) => outboundName(context.index, node) === 'uri');
  const entity = chain.find((node) => outboundName(context.index, node) === 'toEntity');
  return uri
    ? bindingDetails({ context, chain, method, receiver, first, terminal, uri, entity, input })
    : null;
}

interface BindingDetails {
  readonly context: JavaBindingContext;
  readonly chain: readonly SyntaxNode[];
  readonly method: SyntaxNode;
  readonly receiver: SyntaxNode;
  readonly first: SyntaxNode;
  readonly terminal: SyntaxNode;
  readonly uri: SyntaxNode;
  readonly entity: SyntaxNode | undefined;
  readonly input: OutboundInput;
}

function requestOf(details: BindingDetails): OutboundBinding['request'] {
  const { context, chain, first, uri } = details;
  const { index } = context;
  const template = outboundLiteral(context, declarationChildren(index, uri, 'arguments')[0]);
  return {
    method: outboundName(index, first).toUpperCase(),
    method_source: declarationSource(index, first),
    uri_source: declarationSource(index, uri),
    template,
    argument_sources: outboundArguments(index, uri).slice(1),
    headers: chain
      .filter((node) => outboundName(index, node) === 'header')
      .map((node) => ({
        name: outboundLiteral(context, declarationChildren(index, node, 'arguments')[0]),
        source: declarationSource(index, node),
        value_sources: outboundArguments(index, node).slice(1),
      })),
    accept_sources: chain
      .filter((node) => outboundName(index, node) === 'accept')
      .map((node) => declarationSource(index, node)),
    body_sources: chain
      .filter((node) => node !== details.terminal && outboundName(index, node) === 'body')
      .flatMap((node) => outboundArguments(index, node)),
  };
}

function responseOf(details: BindingDetails): OutboundBinding['response'] {
  const { context, method, terminal, entity } = details;
  const { index } = context;
  const response = entity ?? (outboundName(index, terminal) === 'body' ? terminal : undefined);
  const typeNode = response && declarationChildren(index, response, 'arguments')[0];
  const type = outboundClass(context, typeNode);
  return {
    type,
    type_source: typeNode ? declarationSource(index, typeNode) : null,
    body_source: declarationSource(index, terminal),
    return_sources: index.nodes
      .filter((node) => node.kind === 'RETURN' && javaMethod(index, node) === method)
      .map((node) => declarationSource(index, node)),
  };
}

function bindingDetails(details: BindingDetails): OutboundBinding {
  const { context, chain, method, receiver, terminal, uri, input } = details;
  const { index } = context;
  const owner = declarationSource(index, method);
  const client = outboundClient(context, receiver);
  const closure = outboundProvenance(input, owner, client);
  const { calls, values } = closure;
  const template = outboundLiteral(context, declarationChildren(index, uri, 'arguments')[0]);
  const response = responseOf(details);
  const knownShape = template !== null && response.type !== null;
  const knownClient = client.logical_name !== null && closure.complete;
  return {
    kind: 'outbound_binding',
    id: `outbound:${declarationSource(index, terminal)}`,
    source: declarationSource(index, terminal),
    owner_source: owner,
    client,
    request: requestOf(details),
    response,
    failure_paths: outboundFailures(context, terminal),
    call_binding_ids: calls.map((call) => call.id),
    value_binding_ids: values.map((value) => value.id),
    support: [
      owner,
      ...chain.map((node) => declarationSource(index, node)),
      ...(client.registry_source === null ? [] : [client.registry_source]),
    ],
    completeness: knownShape && knownClient ? 'source_path' : 'partial',
    gaps: [
      'Effective external registry configuration, authentication headers, codecs and deployed address are unobserved; this describes source construction.',
      ...(closure.complete
        ? []
        : [
            'The bounded local method traversal reached its limit; further callees remain unresolved.',
          ]),
    ],
  };
}

function responseTerminal(context: JavaBindingContext, node: SyntaxNode): boolean {
  const { index } = context;
  if (outboundName(index, node) === 'getBody') return true;
  if (outboundName(index, node) !== 'body') return false;
  const callee = javaField(index, node, 'callee');
  const receiver = callee && javaField(index, callee, 'receiver');
  const actualArguments = declarationChildren(index, node, 'arguments');
  return (
    receiver?.kind === 'METHOD_INVOCATION' &&
    outboundName(index, receiver) === 'retrieve' &&
    actualArguments.length === 1 &&
    outboundClass(context, actualArguments[0]) !== null
  );
}

/** Recognise a typed Spring RestClient chain and retain its native call/value provenance. */
export function collectOutboundBindings(input: OutboundInput): readonly OutboundBinding[] {
  return input.indexes.flatMap((index) => {
    const unit = input.units.find((candidate) => candidate.path === index.path);
    if (!unit || index.diagnostics.length > 0) return [];
    const context = { index, unit, units: input.units };
    return index.nodes
      .filter((node) => node.kind === 'METHOD_INVOCATION' && responseTerminal(context, node))
      .flatMap((node) => {
        const result = makeBinding(context, outboundChain(index, node), input);
        return result === null ? [] : [result];
      });
  });
}

/** Retain HTTP, GraphQL and supported in-process library boundaries as distinct native records. */
export function collectClientBoundaryBindings(
  input: OutboundInput,
): readonly (OutboundBinding | GraphqlBinding | LibraryBinding)[] {
  return [
    ...collectOutboundBindings(input),
    ...collectGraphqlBindings(input),
    ...collectLibraryBindings(input),
  ];
}
