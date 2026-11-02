import 'server-only';

import type { JavaBindingContext } from './java-call-binding-types';
import { javaExpressionType } from './java-call-resolution';
import { javaAncestors, javaField, javaMethod, javaVariable } from './java-call-syntax';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import type { GraphqlBinding } from './spring-client-boundary-types';
import { outboundClient } from './spring-outbound-client';
import {
  outboundFailures,
  outboundProvenance,
  type OutboundInput,
} from './spring-outbound-provenance';
import {
  outboundArguments,
  outboundClass,
  outboundLiteral,
  outboundName,
} from './spring-outbound-syntax';

/** Follow only a single immutable local origin; ambiguous writes remain a frontier. */
function lineage(
  context: JavaBindingContext,
  node: SyntaxNode,
  seen = new Set<SyntaxNode>(),
): readonly SyntaxNode[] {
  if (seen.has(node) || seen.size >= 32) return [];
  seen.add(node);
  if (node.kind === 'METHOD_INVOCATION') {
    const callee = javaField(context.index, node, 'callee');
    const receiver = callee && javaField(context.index, callee, 'receiver');
    return [...(receiver ? lineage(context, receiver, seen) : []), node];
  }
  const variable = javaVariable(context, node);
  if (!variable) return [];
  const writes = context.index.nodes.filter(
    (entry) =>
      entry.kind === 'ASSIGNMENT' &&
      declarationChildren(context.index, entry, 'targets').some(
        (target) => javaVariable(context, target) === variable,
      ),
  );
  if (writes.length > 0) return [];
  const initial = declarationChildren(context.index, variable, 'values');
  return initial.length === 1 && initial[0] ? lineage(context, initial[0], seen) : [];
}

function executionOwner(index: SourceIndex, node: SyntaxNode): SyntaxNode | undefined {
  return javaAncestors(index, node).find((parent) =>
    ['LAMBDA_EXPRESSION', 'METHOD'].includes(parent.kind),
  );
}

function graphResponse(
  context: JavaBindingContext,
  execution: SyntaxNode,
  method: SyntaxNode,
): {
  readonly responseChain: readonly SyntaxNode[];
  readonly response: GraphqlBinding['response'];
} {
  const { index } = context;
  const chain = lineage(context, execution);
  const projected = index.nodes.filter(
    (node) =>
      node.kind === 'METHOD_INVOCATION' &&
      outboundName(index, node) === 'toEntity' &&
      javaMethod(index, node) === method,
  );
  const bodies = projected.filter(
    (node) =>
      executionOwner(index, node) === executionOwner(index, execution) &&
      lineage(context, node).includes(execution),
  );
  const body = bodies.length === 1 ? bodies[0] : undefined;
  const responseChain = body ? lineage(context, body) : chain;
  const field = responseChain.find((node) =>
    ['retrieveSync', 'field'].includes(outboundName(index, node)),
  );
  const typeNode = body && declarationChildren(index, body, 'arguments')[0];
  return {
    responseChain,
    response: {
      field_path: field
        ? outboundLiteral(context, declarationChildren(index, field, 'arguments')[0])
        : null,
      field_source: field ? declarationSource(index, field) : null,
      type: outboundClass(context, typeNode),
      type_source: typeNode ? declarationSource(index, typeNode) : null,
      body_source: declarationSource(index, body ?? execution),
      return_sources: index.nodes
        .filter(
          (node) =>
            node.kind === 'RETURN' &&
            executionOwner(index, node) === executionOwner(index, execution),
        )
        .map((node) => declarationSource(index, node)),
    },
  };
}

function graphBinding(
  context: JavaBindingContext,
  execution: SyntaxNode,
  input: OutboundInput,
): GraphqlBinding | null {
  const { index } = context;
  const chain = lineage(context, execution);
  const first = chain[0];
  if (!first || outboundName(index, first) !== 'documentName') return null;
  const callee = javaField(index, first, 'callee');
  const receiver = callee && javaField(index, callee, 'receiver');
  const method = javaMethod(index, execution);
  if (
    !receiver ||
    !method ||
    ![
      'org.springframework.graphql.client.GraphQlClient',
      'org.springframework.graphql.client.HttpSyncGraphQlClient',
    ].includes(javaExpressionType(context, receiver) ?? '')
  ) {
    return null;
  }
  const owner = declarationSource(index, method);
  const { responseChain, response } = graphResponse(context, execution, method);
  const client = outboundClient(context, receiver);
  const provenance = outboundProvenance(input, owner, client);
  return {
    kind: 'graphql_binding',
    id: `graphql:${declarationSource(index, execution)}`,
    source: declarationSource(index, execution),
    owner_source: owner,
    client,
    document_name: outboundLiteral(context, declarationChildren(index, first, 'arguments')[0]),
    document_source: declarationSource(index, first),
    variables: chain
      .filter((node) => outboundName(index, node) === 'variable')
      .map((node) => ({
        name: outboundLiteral(context, declarationChildren(index, node, 'arguments')[0]),
        source: declarationSource(index, node),
        value_sources: outboundArguments(index, node).slice(1),
      })),
    execution_source: declarationSource(index, execution),
    response,
    failure_paths: outboundFailures(context, execution),
    call_binding_ids: provenance.calls.map((call) => call.id),
    value_binding_ids: provenance.values.map((value) => value.id),
    support: [
      owner,
      ...responseChain.map((node) => declarationSource(index, node)),
      ...(client.registry_source === null ? [] : [client.registry_source]),
    ],
    completeness: 'partial',
    gaps: [
      'GraphQL document name and source response projection do not establish the loaded document, effective HTTP request, authentication, codecs or deployed address.',
      ...(provenance.complete ? [] : ['The bounded local method traversal reached its limit.']),
    ],
  };
}

/** Typed Spring GraphQL calls preserve source requests without inventing HTTP wire details. */
export function collectGraphqlBindings(input: OutboundInput): readonly GraphqlBinding[] {
  return input.indexes.flatMap((index) => {
    const unit = input.units.find((candidate) => candidate.path === index.path);
    if (!unit || index.diagnostics.length > 0) return [];
    const context = { index, unit, units: input.units };
    return index.nodes
      .filter(
        (node) =>
          node.kind === 'METHOD_INVOCATION' &&
          ['executeSync', 'retrieveSync'].includes(outboundName(index, node)),
      )
      .flatMap((node) => {
        const result = graphBinding(context, node, input);
        return result ? [result] : [];
      });
  });
}
