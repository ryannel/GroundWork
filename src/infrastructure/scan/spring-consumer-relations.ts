import 'server-only';

import type { CallBinding } from './java-call-binding-types';
import { javaAncestors } from './java-call-syntax';
import { declarationSource } from './java-declaration-parts';
import type { JavaAnnotation, JavaMethod, JavaType } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import { consumerArguments, consumerDeferred, consumerNode } from './spring-consumer-source';
import type { ConsumerBinding } from './spring-consumer-types';
import type { OutboundInput } from './spring-outbound-provenance';

export function consumerCall(
  input: OutboundInput,
  call: CallBinding,
): ConsumerBinding['calls'][number] {
  return {
    call_binding_id: call.id,
    source: call.call,
    owner_source: call.caller,
    target_source: call.target,
    operation: call.methodName,
    receiver_type: call.receiverType,
    argument_sources: consumerArguments(input, call),
    execution: execution(input, call),
  };
}

function execution(
  input: OutboundInput,
  call: CallBinding,
): ConsumerBinding['calls'][number]['execution'] {
  const selected = consumerNode(input, call.call);
  if (selected && consumerDeferred(selected.index, selected.node)) return 'deferred_source';
  for (const type of input.units.flatMap((unit) => unit.types)) {
    const method = type.methods.find((entry) => entry.source === call.target);
    if (
      method &&
      [...method.annotations, ...type.annotations].some(
        (entry) => entry.name === 'org.springframework.scheduling.annotation.Async',
      )
    ) {
      return 'async_declared';
    }
  }
  return 'direct_source';
}

interface Paths {
  readonly returns: readonly string[];
  readonly throws: readonly string[];
  readonly catches: readonly string[];
  readonly support: readonly string[];
}
function owned(index: SourceIndex, node: SyntaxNode, owners: ReadonlySet<string>) {
  const method = javaAncestors(index, node).find((entry) => entry.kind === 'METHOD');
  return (
    method !== undefined &&
    owners.has(declarationSource(index, method)) &&
    !consumerDeferred(index, node)
  );
}

export function ownedPaths(input: OutboundInput, owners: ReadonlySet<string>): Paths {
  const returns: string[] = [];
  const throws: string[] = [];
  const catches: string[] = [];
  const support: string[] = [];
  for (const index of input.indexes) {
    for (const node of index.nodes.filter((entry) => owned(index, entry, owners))) {
      const source = declarationSource(index, node);
      support.push(source);
      if (node.kind === 'RETURN') returns.push(source);
      if (node.kind === 'THROW') throws.push(source);
      if (node.kind === 'CATCH') catches.push(source);
    }
  }
  return { returns, throws, catches, support };
}

interface Details {
  readonly owner: JavaType;
  readonly method: JavaMethod;
  readonly annotation: JavaAnnotation;
  readonly selectors: ConsumerBinding['selectors'];
  readonly parameters: ConsumerBinding['parameters'];
  readonly factories: ConsumerBinding['factory_candidates'];
  readonly deserialisations: ConsumerBinding['deserialisations'];
  readonly models: ConsumerBinding['model_declarations'];
  readonly callRecords: ConsumerBinding['calls'];
  readonly candidates: ConsumerBinding['candidate_helpers'];
  readonly paths: Paths;
}

export function consumerSupport(details: Details): readonly string[] {
  const {
    owner,
    method,
    annotation,
    selectors,
    parameters,
    factories,
    deserialisations,
    models,
    callRecords,
    candidates,
    paths,
  } = details;
  return [
    ...new Set([
      owner.source,
      method.source,
      annotation.source,
      ...selectors.map((entry) => entry.source),
      ...parameters.flatMap((entry) => [
        entry.source,
        ...(entry.payload_annotation_source === null ? [] : [entry.payload_annotation_source]),
      ]),
      ...factories.flatMap((entry) => [entry.source, entry.annotation_source]),
      ...deserialisations.flatMap((entry) => [
        entry.source,
        entry.owner_source,
        ...entry.argument_sources,
        ...entry.type_reference_sources,
      ]),
      ...models.flatMap((entry) => [entry.source, ...entry.field_sources]),
      ...callRecords.flatMap((entry) => [entry.source, ...entry.argument_sources]),
      ...candidates.flatMap((entry) => [
        entry.call_source,
        entry.target_source,
        ...entry.argument_sources,
        ...entry.parameter_sources,
      ]),
      ...paths.support,
    ]),
  ];
}
