import type { OutboundBinding, ScanDocument, SemanticNode } from '@/domain/scan/scan.generated';

import {
  profileCall,
  profileGraph,
  profileMethod,
  profileReference,
  profileReturned,
  profileScalar,
  type ProfileGraph,
} from './scan-profile-review-graph';
import { descendants, targets } from './scan-semantic-query';

function registryArgument(graph: ProfileGraph, actual: SemanticNode | undefined, expected: string) {
  if (!actual) return false;
  const declarations = graph.values.filter(
    (value) => value.relation === 'reference' && value.to === actual.source,
  );
  return declarations.some((declaration) =>
    graph.values.some((assignment) => {
      if (assignment.relation !== 'assignment' || assignment.to !== declaration.from) return false;
      const call = graph.calls.find(
        (binding) => binding.call === assignment.from && binding.methodName === 'getClient',
      );
      const argument = targets(graph, graph.bySource.get(assignment.from), 'argument')[0];
      return (
        call?.receiverType === 'com.volvocars.ecom.restclient.RestClientRegistry' &&
        profileScalar(graph, argument?.source ?? '') === expected
      );
    }),
  );
}

function dispatcher(graph: ProfileGraph, target: SemanticNode) {
  const sources = profileMethod(graph, 'VolvoIdClient', 'getUserInfo');
  const owner = sources.find((node) => targets(graph, node, 'parameter').length === 1);
  if (!owner) return false;
  const calls = graph.calls.filter(
    (call) =>
      call.caller === owner.source && call.target === target.source && call.resolution === 'exact',
  );
  if (calls.length !== 2) return false;
  return calls.every((call) => {
    const args = targets(graph, graph.bySource.get(call.call), 'argument');
    const path = profileScalar(graph, args[1]?.source ?? '');
    const branch = path === '/protocol/openid-connect/userinfo';
    const logical = branch ? 'volvo-id-keycloak' : 'volvo-id';
    const validPath = branch || path === '/idp/userinfo.openid';
    return (
      validPath &&
      registryArgument(graph, args[0], logical) &&
      tokenArgument(graph, { owner, target, call: call.call, actual: args[2] }) &&
      profileReturned(graph, owner, call.call)
    );
  });
}

function tokenArgument(
  graph: ProfileGraph,
  input: {
    readonly owner: SemanticNode;
    readonly target: SemanticNode;
    readonly call: string;
    readonly actual: SemanticNode | undefined;
  },
) {
  const token = targets(graph, input.owner, 'parameter')[0];
  const formal = targets(graph, input.target, 'parameter')[2];
  const actual = input.actual;
  if (!token || !formal || !actual) return false;
  return (
    profileReference(graph, token.source, actual.source) &&
    graph.values.some(
      (value) =>
        value.relation === 'argument_parameter' &&
        value.call === input.call &&
        value.from === actual.source &&
        value.to === formal.source,
    )
  );
}

function bearerHeader(graph: ProfileGraph, boundary: OutboundBinding) {
  const header = boundary.request.headers.find((entry) => entry.name === 'Authorization');
  const value = graph.bySource.get(header?.value_sources[0] ?? '');
  if (value?.operator !== '+' || header === undefined) return false;
  const left = targets(graph, value, 'left')[0];
  const right = targets(graph, value, 'right')[0];
  const owner = graph.bySource.get(boundary.owner_source);
  const token = targets(graph, owner, 'parameter')[2];
  const name = targets(graph, graph.bySource.get(header.source), 'argument')[0];
  return (
    profileScalar(graph, name?.source ?? '') === 'Authorization' &&
    profileScalar(graph, left?.source ?? '') === 'Bearer ' &&
    tokenReference(graph, token, right)
  );
}

function tokenReference(
  graph: ProfileGraph,
  token: SemanticNode | undefined,
  right: SemanticNode | undefined,
) {
  return (
    token !== undefined &&
    right !== undefined &&
    profileReference(graph, token.source, right.source)
  );
}

function resultReturned(graph: ProfileGraph, boundary: OutboundBinding) {
  const owner = graph.bySource.get(boundary.owner_source);
  const initialise = graph.values.find(
    (value) => value.relation === 'initializer' && value.from === boundary.response.body_source,
  );
  if (!owner || !initialise) return false;
  return graph.values.some(
    (value) =>
      value.relation === 'reference' &&
      value.from === initialise.to &&
      profileReturned(graph, owner, value.to),
  );
}

function emptyBodyGuard(graph: ProfileGraph, boundary: OutboundBinding) {
  const owner = graph.bySource.get(boundary.owner_source);
  const initialise = graph.values.find(
    (value) => value.relation === 'initializer' && value.from === boundary.response.body_source,
  );
  if (!owner || !initialise) return false;
  return graph.nodes
    .filter((node) => node.owner === owner.owner && node.nodeKind === 'if')
    .some((branch) => {
      const condition = targets(graph, branch, 'condition')[0];
      const left = targets(graph, condition, 'left')[0];
      const right = targets(graph, condition, 'right')[0];
      const matches =
        condition?.operator === '==' &&
        left !== undefined &&
        profileReference(graph, initialise.to, left.source);
      return (
        matches &&
        right?.nodeKind === 'literal' &&
        right.value === null &&
        targets(graph, branch, 'consequent').some((body) =>
          descendants(graph, body).some((node) => node.nodeKind === 'throw'),
        )
      );
    });
}

/** The shared source helper and its two concrete invocation contexts. */
export function profileVolvoBoundary(document: ScanDocument): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  const owners = profileMethod(graph, 'VolvoIdClient', 'getUserInfo');
  const owner = owners.find((node) => targets(graph, node, 'parameter').length === 3);
  const boundaries = document.bindings?.filter(
    (record) => record.kind === 'outbound_binding' && record.owner_source === owner?.source,
  );
  const boundary = boundaries?.[0];
  if (!owner || boundaries?.length !== 1 || boundary?.kind !== 'outbound_binding') {
    return { uniqueBoundary: false, supported: false };
  }
  const clauses = {
    uniqueBoundary: true,
    dispatchArguments: dispatcher(graph, owner),
    bearerHeader: bearerHeader(graph, boundary),
    method:
      boundary.request.method === 'GET' &&
      profileCall(graph, boundary.request.method_source, 'get') !== undefined,
    responseType:
      boundary.response.type === 'com.volvocars.ecom.customerservice.volvoid.userinfo.VolvoIdUser',
    resultReturned: resultReturned(graph, boundary),
    emptyBodyGuard: emptyBodyGuard(graph, boundary),
    failures:
      boundary.failure_paths.some(
        (path) =>
          path.caught_type.endsWith('.BadRequest') &&
          path.thrown_type?.endsWith('.VolvoIdBadRequestException') === true,
      ) &&
      boundary.failure_paths.some(
        (path) =>
          path.caught_type.endsWith('.RestClientException') &&
          path.thrown_type?.endsWith('.VolvoIdException') === true,
      ),
  };
  return { ...clauses, supported: Object.values(clauses).every(Boolean) };
}
