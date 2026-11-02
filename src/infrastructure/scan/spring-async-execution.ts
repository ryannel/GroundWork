import 'server-only';

import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { JavaMethod, JavaType } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import { asyncCallUse, asyncFutureCall, asyncOwnedNodes } from './spring-async-source';
import type { ExecutionBinding } from './spring-async-types';
import type { OutboundInput } from './spring-outbound-provenance';

const TRANSACTION = 'org.springframework.transaction.annotation.Transactional';

export function methodValues(
  input: OutboundInput,
  sources: ReadonlySet<string>,
): readonly string[] {
  return input.values
    .filter((value) => sources.has(value.from) || sources.has(value.to))
    .map((value) => value.id);
}

function executionPaths(
  index: SourceIndex,
  nodes: readonly SyntaxNode[],
  declaration: { readonly owner: JavaType; readonly method: JavaMethod },
) {
  const { owner, method } = declaration;
  const ofKind = (kind: string) =>
    nodes.filter((node) => node.kind === kind).map((node) => declarationSource(index, node));
  const finallySources = nodes
    .filter((node) => node.kind === 'TRY')
    .flatMap((node) =>
      declarationChildren(index, node, 'finally').map((entry) => declarationSource(index, entry)),
    );
  const transactionSources = [...owner.annotations, ...method.annotations]
    .filter((entry) => entry.name === TRANSACTION)
    .map((entry) => entry.source);
  return {
    return_sources: ofKind('RETURN'),
    throw_sources: ofKind('THROW'),
    catch_sources: ofKind('CATCH'),
    finally_sources: finallySources,
    transaction_sources: transactionSources,
  };
}

export function executionDeclaration(
  input: OutboundInput,
  index: SourceIndex,
  declaration: { readonly owner: JavaType; readonly method: JavaMethod },
): ExecutionBinding {
  const { owner, method } = declaration;
  const nodes = asyncOwnedNodes(index, method);
  const sources = new Set(nodes.map((node) => declarationSource(index, node)));
  const calls = input.calls.filter((call) => sources.has(call.call));
  const callResults = calls.flatMap((call) => {
    const node = nodes.find((entry) => declarationSource(index, entry) === call.call);
    return node
      ? [
          {
            call_source: call.call,
            call_binding_id: call.id,
            ...asyncCallUse(index, node, asyncFutureCall(input, call)),
          },
        ]
      : [];
  });
  const paths = executionPaths(index, nodes, declaration);
  return {
    kind: 'execution_binding',
    id: `execution:${method.source}`,
    source: method.source,
    owner_source: owner.source,
    owner_type: owner.qualifiedName,
    call_results: callResults,
    ...paths,
    transaction:
      paths.transaction_sources.length > 0
        ? 'declared_runtime_unverified'
        : 'none_in_selected_declaration',
    failure: 'source_paths_only',
    completion: 'source_returns_only',
    call_binding_ids: calls.map((call) => call.id),
    value_binding_ids: methodValues(input, sources),
    support: [
      ...new Set([
        owner.source,
        method.source,
        ...Object.values(paths).flat(),
        ...callResults.flatMap((entry) => [entry.call_source, entry.use_source]),
      ]),
    ],
    completeness: 'partial',
    gaps: [
      'Source paths exclude deferred lambda and nested type bodies; no whole-program exception, transaction, completion or delivery guarantee is inferred.',
    ],
  };
}
