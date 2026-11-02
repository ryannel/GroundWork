import type { ScanDocument } from '@/domain/scan/scan.generated';
import type { CallBinding, ValueBinding } from '@/infrastructure/scan/java-call-binding-types';
import type { OutboundBinding } from '@/infrastructure/scan/spring-outbound-types';

import { outboundFlowProof } from './scan-outbound-review-flow';
import { descendants, semanticGraph, targets } from './scan-semantic-query';

interface OutboundReviewInput {
  readonly document: ScanDocument;
  readonly calls: readonly CallBinding[];
  readonly values: readonly ValueBinding[];
  readonly outbound: readonly OutboundBinding[];
}

function clientValueFlow(input: OutboundReviewInput, outbound: OutboundBinding): boolean {
  const values = input.values.filter((value) => outbound.value_binding_ids.includes(value.id));
  return values.some(
    (assignment) =>
      assignment.relation === 'assignment' &&
      assignment.from === outbound.client.registry_source &&
      values.some(
        (reference) =>
          reference.relation === 'reference' &&
          reference.from === assignment.to &&
          reference.to === outbound.client.receiver_source,
      ),
  );
}

function failuresMatch(
  outbound: OutboundBinding,
  graph: ReturnType<typeof semanticGraph>,
): boolean {
  const attempts = graph.nodes.filter(
    (node) =>
      node.nodeKind === 'try' &&
      targets(graph, node, 'body').some((body) =>
        descendants(graph, body).some((child) => child.source === outbound.response.body_source),
      ),
  );
  const attempt = attempts.length === 1 ? attempts[0] : undefined;
  if (!attempt) return false;
  const status = outbound.failure_paths
    .map((failure) =>
      [failure.caught_type.split('.').at(-1), failure.thrown_type?.split('.').at(-1)].join(':'),
    )
    .toSorted((left, right) => left.localeCompare(right));
  return (
    JSON.stringify(status) ===
      JSON.stringify([
        'BadRequest:FleetAccountBadRequestException',
        'NotFound:FleetAccountNotFoundException',
        'RestClientException:FleetServiceException',
      ]) &&
    outbound.failure_paths.every(
      (failure) =>
        targets(graph, attempt, 'catch').some((caught) => caught.source === failure.source) &&
        translationMatches(graph, failure),
    )
  );
}

function translationMatches(
  graph: ReturnType<typeof semanticGraph>,
  failure: OutboundBinding['failure_paths'][number],
): boolean {
  const caught = graph.nodes.find(
    (node) => node.source === failure.source && node.nodeKind === 'catch',
  );
  const statements = targets(graph, caught, 'body').flatMap((body) =>
    targets(graph, body, 'statement'),
  );
  return statements.some(
    (statement) =>
      statement.nodeKind === 'throw' &&
      targets(graph, statement, 'value').some((value) => value.source === failure.thrown_source),
  );
}

/** Frozen Fleet client proof; all data flow comes from records returned by the bounded API. */
export function outboundFleetProof(input: OutboundReviewInput): Readonly<Record<string, boolean>> {
  const selected = input.outbound.filter(
    (record) =>
      record.client.logical_name === 'fleet' &&
      record.request.template === '/v1/fleetaccounts/{fleetAccountId}',
  );
  const outbound = selected[0];
  if (selected.length !== 1 || !outbound) return { uniquePath: false, supported: false };
  const graph = semanticGraph(input.document);
  const owner = graph.nodes.find(
    (node) =>
      node.source === outbound.owner_source &&
      node.name === 'getFleetAccount' &&
      node.nodeKind === 'function',
  );
  const request = input.calls.find(
    (call) =>
      call.call === outbound.request.method_source &&
      call.methodName === 'get' &&
      call.receiverType === 'org.springframework.web.client.RestClient',
  );
  const registry = input.calls.find(
    (call) =>
      call.call === outbound.client.registry_source &&
      call.methodName === 'getClient' &&
      call.receiverType === 'com.volvocars.ecom.restclient.RestClientRegistry',
  );
  const clauses = {
    uniquePath: true,
    request:
      owner !== undefined &&
      outbound.request.method === 'GET' &&
      request !== undefined &&
      outbound.call_binding_ids.includes(request.id),
    logicalClient: registry !== undefined && clientValueFlow(input, outbound),
    responseType:
      outbound.response.type?.endsWith('.FleetAccountResponse') === true &&
      outbound.response.type_source !== null &&
      input.document.sources.some((source) => source.id === outbound.response.type_source),
    ...outboundFlowProof({ ...input, outbound }),
    errorTranslations: failuresMatch(outbound, graph),
  };
  return { ...clauses, supported: Object.values(clauses).every(Boolean) };
}
