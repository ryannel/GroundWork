import type { ScanDocument, SemanticNode } from '@/domain/scan/scan.generated';
import type { CallBinding, ValueBinding } from '@/infrastructure/scan/java-call-binding-types';
import type { SpringExceptionBinding } from '@/infrastructure/scan/spring-exception-types';

import { expressionSpelling } from './scan-semantic-expression';
import { descendants, semanticGraph, targets, type SemanticGraph } from './scan-semantic-query';

export interface ExceptionReviewInput {
  readonly document: ScanDocument;
  readonly calls: readonly CallBinding[];
  readonly values: readonly ValueBinding[];
  readonly exceptions: readonly SpringExceptionBinding[];
}

function method(graph: SemanticGraph, suffix: string): SemanticNode | undefined {
  const paths = new Set(
    graph.document.sources
      .filter((source) => source.path.endsWith(suffix))
      .map((source) => source.id),
  );
  const matches = graph.nodes.filter(
    (node) =>
      node.nodeKind === 'function' && node.name === 'updateIndividual' && paths.has(node.source),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function callPath(
  input: ExceptionReviewInput,
  graph: SemanticGraph,
  pair: readonly [SemanticNode | undefined, SemanticNode | undefined],
): boolean {
  const [from, to] = pair;
  if (!from || !to) return false;
  const matches = input.calls.filter(
    (call) =>
      call.caller === from.source && call.target === to.source && call.resolution === 'exact',
  );
  if (matches.length !== 1) return false;
  const call = graph.nodes.find(
    (node) => node.source === matches[0]?.call && node.nodeKind === 'call',
  );
  if (
    !call ||
    !descendants(graph, from).includes(call) ||
    !parameterFlow(input, graph, [from, to, call])
  ) {
    return false;
  }
  return !graph.nodes.some(
    (node) =>
      node.owner === call.owner &&
      node.nodeKind === 'try' &&
      descendants(graph, node).includes(call),
  );
}

function parameterFlow(
  input: ExceptionReviewInput,
  graph: SemanticGraph,
  nodes: readonly [SemanticNode, SemanticNode, SemanticNode],
): boolean {
  const [from, to, call] = nodes;
  const source = targets(graph, from, 'parameter').find((parameter) => parameter.name === 'id');
  const target = targets(graph, to, 'parameter').find((parameter) =>
    ['id', 'individualId'].includes(parameter.name ?? ''),
  );
  if (!source || !target) return false;
  return input.values.some(
    (value) =>
      value.relation === 'argument_parameter' &&
      value.call === call.source &&
      value.to === target.source &&
      input.values.some(
        (reference) =>
          reference.relation === 'reference' &&
          reference.from === source.source &&
          reference.to === value.from,
      ),
  );
}

function membership(
  graph: SemanticGraph,
  owner: SemanticNode | undefined,
  binding: SpringExceptionBinding | undefined,
): boolean {
  if (!owner || !binding) return false;
  const thrown = graph.nodes.find(
    (node) => node.source === binding.throw_source_id && node.nodeKind === 'throw',
  );
  return graph.nodes.some(
    (branch) =>
      branch.nodeKind === 'if' &&
      branch.owner === owner.owner &&
      targets(graph, branch, 'condition').some(
        (condition) =>
          binding.guard_source_ids.includes(condition.source) &&
          targets(graph, condition, 'callee').some(
            (callee) =>
              expressionSpelling(graph, callee) ===
              'originalCustomer.individuals().stream().noneMatch',
          ) &&
          descendants(graph, condition, [
            'ast_child',
            'callback',
            'argument',
            'body',
            'callee',
            'receiver',
            'value',
          ]).some(
            (node) => expressionSpelling(graph, node) === 'individual.id().equals(individualId)',
          ),
      ) &&
      targets(graph, branch, 'consequent').some((body) =>
        descendants(graph, body).some((node) => node.id === thrown?.id),
      ),
  );
}

function thrownArgument(
  graph: SemanticGraph,
  binding: SpringExceptionBinding | undefined,
): boolean {
  if (!binding) return false;
  const thrown = graph.nodes.find(
    (node) => node.source === binding.throw_source_id && node.nodeKind === 'throw',
  );
  return targets(graph, thrown, 'value').some(
    (creation) =>
      creation.nodeKind === 'construct' &&
      targets(graph, creation, 'callee').some(
        (callee) => callee.name === 'IndividualNotFoundException',
      ) &&
      targets(graph, creation, 'argument').some(
        (argument) =>
          binding.constructor_argument_source_ids.includes(argument.source) &&
          argument.nodeKind === 'identifier' &&
          argument.name === 'individualId',
      ),
  );
}

function responseConstruction(
  graph: SemanticGraph,
  binding: SpringExceptionBinding | undefined,
): boolean {
  const handler = binding?.candidates.length === 1 ? binding.candidates[0] : undefined;
  if (!handler) return false;
  return handler.response_return_source_ids.some((source) => {
    const invocation = graph.nodes.find(
      (node) => node.source === source && node.nodeKind === 'call',
    );
    const owned =
      handler.response_construction_source_ids.includes(source) &&
      handler.response_construction_owners.some(
        (entry) =>
          entry.source_id === source && entry.owner_method_source_id === handler.handler_source_id,
      );
    return (
      owned &&
      invocation !== undefined &&
      targets(graph, invocation, 'argument').some(
        (argument) => expressionSpelling(graph, argument) === handler.response_status,
      ) &&
      graph.nodes.some(
        (node) =>
          node.nodeKind === 'return' && targets(graph, node, 'returns').includes(invocation),
      )
    );
  });
}

function applicable(binding: SpringExceptionBinding | undefined): boolean {
  const handler = binding?.candidates.length === 1 ? binding.candidates[0] : undefined;
  return (
    binding?.resolution === 'resolved' &&
    binding.local_controller_handler_source_ids.length === 0 &&
    handler?.scope === 'global' &&
    handler.handled_type === binding.thrown_type
  );
}

/** Q05's frozen clauses, proved from retrieved records rather than display syntax. */
export function exceptionUpdateProof(
  input: ExceptionReviewInput,
): Readonly<Record<string, boolean>> {
  const graph = semanticGraph(input.document);
  const service = method(graph, '/customer/CustomerService.java');
  const api = method(graph, '/impl/CustomerApiService.java');
  const controller = method(graph, '/impl/CustomerControllerImpl.java');
  const bindings = input.exceptions.filter(
    (binding) =>
      binding.throwing_method_source_id === service?.source &&
      binding.thrown_type.endsWith('.IndividualNotFoundException'),
  );
  const binding = bindings.length === 1 ? bindings[0] : undefined;
  const handler = binding?.candidates.length === 1 ? binding.candidates[0] : undefined;
  const route =
    input.document.framework?.some(
      (record) =>
        record.kind === 'route_binding' &&
        record.http_method === 'PUT' &&
        record.path === '/v1/customers/{customerId}/individual/{id}' &&
        record.method.implementation_source_id === controller?.source,
    ) === true;
  const proof = {
    membershipGuard: membership(graph, service, binding),
    thrownIndividualId: thrownArgument(graph, binding),
    applicableHandler: applicable(binding),
    httpNotFound: handler?.response_status === 'HttpStatus.NOT_FOUND',
    endpointPropagation:
      route && callPath(input, graph, [controller, api]) && callPath(input, graph, [api, service]),
    responseConstruction: responseConstruction(graph, binding),
  };
  return { ...proof, supported: Object.values(proof).every(Boolean) };
}
