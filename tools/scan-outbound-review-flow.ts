import type { ScanDocument } from '@/domain/scan/scan.generated';
import type { CallBinding, ValueBinding } from '@/infrastructure/scan/java-call-binding-types';
import type { OutboundBinding } from '@/infrastructure/scan/spring-outbound-types';

import { outboundNullGuard } from './scan-outbound-review-guard';
import { semanticGraph, targets, type SemanticGraph } from './scan-semantic-query';

interface FlowInput {
  readonly document: ScanDocument;
  readonly outbound: OutboundBinding;
  readonly calls: readonly CallBinding[];
  readonly values: readonly ValueBinding[];
}

function valueLinks(input: FlowInput, relation: ValueBinding['relation']): readonly ValueBinding[] {
  return input.values.filter(
    (value) => value.relation === relation && input.outbound.value_binding_ids.includes(value.id),
  );
}

function inputFlow(input: FlowInput, graph: SemanticGraph): boolean {
  const owner = graph.nodes.find(
    (node) => node.source === input.outbound.owner_source && node.nodeKind === 'function',
  );
  const parameter = targets(graph, owner, 'parameter').find(
    (node) => node.name === 'fleetAccountId',
  );
  return (
    parameter !== undefined &&
    input.outbound.request.argument_sources.length === 1 &&
    valueLinks(input, 'reference').some(
      (value) =>
        value.from === parameter.source && value.to === input.outbound.request.argument_sources[0],
    )
  );
}

function responseFlow(input: FlowInput, graph: SemanticGraph): boolean {
  const initialise = valueLinks(input, 'initializer').find(
    (value) => value.from === input.outbound.response.body_source,
  );
  const nullCheck = input.calls.find(
    (call) =>
      call.caller === input.outbound.owner_source &&
      call.methodName === 'nullCheck' &&
      call.resolution === 'exact' &&
      input.outbound.call_binding_ids.includes(call.id),
  );
  if (!initialise || !nullCheck) return false;
  const actual = valueLinks(input, 'argument_parameter').find(
    (value) =>
      value.call === nullCheck.call &&
      valueLinks(input, 'reference').some(
        (reference) => reference.from === initialise.to && reference.to === value.from,
      ),
  );
  const returned = valueLinks(input, 'return_call').find(
    (value) =>
      value.to === nullCheck.call &&
      valueLinks(input, 'reference').some(
        (reference) => reference.from === actual?.to && reference.to === value.from,
      ),
  );
  const projection = valueLinks(input, 'field_projection').find((value) => {
    const call = graph.nodes.find((node) => node.source === value.to && node.nodeKind === 'call');
    return targets(graph, targets(graph, call, 'callee')[0], 'receiver').some(
      (receiver) => receiver.source === nullCheck.call,
    );
  });
  if (!actual || !returned || !projection) return false;
  const schemas =
    input.document.framework?.filter((record) => record.kind === 'schema_binding') ?? [];
  const field = schemas
    .find((schema) => schema.typeName === input.outbound.response.type)
    ?.properties.find(
      (property) => property.name === 'data' && property.source === projection.from,
    );
  return (
    field !== undefined &&
    input.outbound.response.return_sources.some((source) => {
      const statement = graph.nodes.find(
        (node) => node.source === source && node.nodeKind === 'return',
      );
      return targets(graph, statement, 'returns').some((value) => value.source === projection.to);
    })
  );
}

export function outboundFlowProof(input: FlowInput): {
  readonly inputToUri: boolean;
  readonly responseToReturn: boolean;
  readonly nullResponseGuard: boolean;
} {
  const graph = semanticGraph(input.document);
  const nullCheck = input.calls.find(
    (call) =>
      call.caller === input.outbound.owner_source &&
      call.methodName === 'nullCheck' &&
      call.resolution === 'exact',
  );
  return {
    inputToUri: inputFlow(input, graph),
    responseToReturn: responseFlow(input, graph),
    nullResponseGuard: outboundNullGuard(input.document, nullCheck?.target ?? null),
  };
}
