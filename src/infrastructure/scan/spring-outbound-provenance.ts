import 'server-only';

import type { CallBinding, JavaBindingContext, ValueBinding } from './java-call-binding-types';
import { javaAncestors } from './java-call-syntax';
import { declarationChildren, declarationSource, declarationText } from './java-declaration-parts';
import { resolveJavaType, type JavaUnit } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import type { OutboundBinding } from './spring-outbound-types';

export interface OutboundInput {
  readonly indexes: readonly SourceIndex[];
  readonly units: readonly JavaUnit[];
  readonly calls: readonly CallBinding[];
  readonly values: readonly ValueBinding[];
}

export function outboundFailures(
  context: JavaBindingContext,
  node: SyntaxNode,
): OutboundBinding['failure_paths'] {
  const attempt = javaAncestors(context.index, node).find((ancestor) => ancestor.kind === 'TRY');
  if (!attempt) return [];
  return declarationChildren(context.index, attempt, 'catches').map((caught) => {
    const parameter = declarationChildren(context.index, caught, 'parameters')[0];
    const type = parameter && declarationText(context.index, parameter, 'type')[0];
    const creations = context.index.nodes.filter(
      (candidate) =>
        candidate.kind === 'NEW_CLASS' &&
        javaAncestors(context.index, candidate).includes(caught) &&
        immediateThrow(context.index, candidate, caught),
    );
    const creation = creations.length === 1 ? creations[0] : undefined;
    const translated = creation && declarationText(context.index, creation, 'callee')[0];
    return {
      caught_type: type === undefined ? 'unresolved' : resolveJavaType(type, context.unit),
      source: declarationSource(context.index, caught),
      thrown_type: translated === undefined ? null : resolveJavaType(translated, context.unit),
      thrown_source: creation ? declarationSource(context.index, creation) : null,
    };
  });
}

function immediateThrow(index: SourceIndex, node: SyntaxNode, caught: SyntaxNode): boolean {
  const parents = javaAncestors(index, node);
  const immediate = parents.slice(0, parents.indexOf(caught));
  return (
    immediate.some((parent) => parent.kind === 'THROW') &&
    !immediate.some((parent) => ['METHOD', 'CLASS', 'LAMBDA_EXPRESSION'].includes(parent.kind))
  );
}

function methodClosure(
  input: OutboundInput,
  source: string,
): { readonly calls: readonly CallBinding[]; readonly complete: boolean } {
  const incoming = input.calls.filter((call) => call.target === source);
  const selected: CallBinding[] = [...incoming];
  const pending = [
    source,
    ...incoming.flatMap((call) => (call.caller === null ? [] : [call.caller])),
  ];
  const visited = new Set<string>();
  while (pending.length > 0 && visited.size < 64) {
    const current = pending.shift();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);
    for (const call of input.calls.filter((candidate) => candidate.caller === current)) {
      selected.push(call);
      if (call.target !== null) pending.push(call.target);
    }
  }
  return {
    calls: [...new Map(selected.map((call) => [call.id, call])).values()],
    complete: pending.length === 0,
  };
}

function valueScope(
  input: OutboundInput,
  calls: readonly CallBinding[],
  owner: string,
): ReadonlySet<string> {
  const owners = new Set([
    owner,
    ...calls.flatMap((call) => [call.caller, call.target].filter((source) => source !== null)),
  ]);
  return new Set(
    input.indexes.flatMap((index) => {
      const methods = index.nodes.filter(
        (node) => node.kind === 'METHOD' && owners.has(declarationSource(index, node)),
      );
      return methods.length === 0
        ? []
        : index.nodes
            .filter((node) =>
              methods.some((method) => node.start >= method.start && node.end <= method.end),
            )
            .map((node) => declarationSource(index, node));
    }),
  );
}

function clientValues(
  input: OutboundInput,
  client: OutboundBinding['client'],
): readonly ValueBinding[] {
  const reads = input.values.filter(
    (value) => value.relation === 'reference' && value.to === client.receiver_source,
  );
  return [
    ...reads,
    ...input.values.filter(
      (value) =>
        reads.some((read) => read.from === value.to) &&
        ['initializer', 'assignment'].includes(value.relation),
    ),
  ];
}

export function outboundProvenance(
  input: OutboundInput,
  owner: string,
  client: OutboundBinding['client'],
): {
  readonly calls: readonly CallBinding[];
  readonly values: readonly ValueBinding[];
  readonly complete: boolean;
} {
  const closure = methodClosure(input, owner);
  const calls = [
    ...closure.calls,
    ...input.calls.filter((call) => call.call === client.registry_source),
  ];
  const callSources = new Set(calls.map((call) => call.call));
  const nodeSources = valueScope(input, calls, owner);
  const values = [
    ...new Map(
      [
        ...input.values.filter(
          (value) =>
            nodeSources.has(value.from) ||
            nodeSources.has(value.to) ||
            (value.call !== null && callSources.has(value.call)),
        ),
        ...clientValues(input, client),
      ].map((value) => [value.id, value]),
    ).values(),
  ];
  return { calls, values, complete: closure.complete };
}
