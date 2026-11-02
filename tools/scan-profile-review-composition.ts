import type { ScanDocument, SemanticNode } from '@/domain/scan/scan.generated';

import {
  profileGraph,
  profileMethod,
  profileReceiver,
  profileReference,
  profileReturned,
  type ProfileGraph,
} from './scan-profile-review-graph';
import { targets } from './scan-semantic-query';

function initialisedReference(graph: ProfileGraph, from: string, to: string): boolean {
  return graph.values.some(
    (value) =>
      value.relation === 'initializer' &&
      value.from === from &&
      profileReference(graph, value.to, to),
  );
}

function creationResult(graph: ProfileGraph, owner: SemanticNode): boolean {
  const listCalls = graph.calls.filter(
    (call) =>
      call.caller === owner.source &&
      call.methodName === 'create' &&
      call.receiverType?.endsWith('.ICorporateEntityListFactory') === true,
  );
  const constructors = graph.nodes.filter(
    (node) => node.owner === owner.owner && node.nodeKind === 'construct',
  );
  return (
    listCalls.length === 1 &&
    constructors.some((construction) => {
      const callee = targets(graph, construction, 'callee')[0];
      const corporateEntities = targets(graph, construction, 'argument')[1];
      return (
        callee?.name === 'Customer' &&
        corporateEntities !== undefined &&
        initialisedReference(graph, listCalls[0]?.call ?? '', corporateEntities.source) &&
        profileReturned(graph, owner, construction.source)
      );
    })
  );
}

function factoryDispatch(graph: ProfileGraph): boolean {
  const owner = profileMethod(graph, 'ICorporateEntityFactory', 'mapCreate')[0];
  if (!owner) return false;
  return ['FleetCorporateEntityFactory', 'PartnerCorporateEntityFactory'].every((type) => {
    const calls = graph.calls.filter(
      (call) =>
        call.caller === owner.source &&
        call.methodName === 'create' &&
        call.receiverType?.endsWith(`.${type}`) === true,
    );
    const call = calls[0];
    if (calls.length !== 1 || call?.resolution !== 'exact') return false;
    return (
      call.guards.length > 0 &&
      graph.values.some(
        (value) => value.relation === 'argument_parameter' && value.call === call.call,
      ) &&
      profileReturned(graph, owner, call.call)
    );
  });
}

function listMapping(graph: ProfileGraph): boolean {
  const owner = profileMethod(graph, 'ICorporateEntityListFactory', 'create')[0];
  if (!owner) return false;
  const mapping = graph.calls.find(
    (call) =>
      call.caller === owner.source &&
      call.receiverType?.endsWith('.ICorporateEntityFactory') === true &&
      call.methodName === 'create',
  );
  const returned = graph.nodes
    .filter((node) => node.owner === owner.owner && node.nodeKind === 'return')
    .flatMap((node) => targets(graph, node, 'returns'));
  return mapping?.resolution === 'exact' && returned.some((result) => listChain(graph, result));
}

function listChain(graph: ProfileGraph, result: SemanticNode): boolean {
  const terminal = graph.calls.find(
    (call) => call.call === result.source && call.methodName === 'toList',
  );
  const filter = profileReceiver(graph, result);
  const map = profileReceiver(graph, filter);
  const selected = targets(graph, filter, 'argument')[0];
  return (
    terminal !== undefined &&
    targets(graph, filter, 'callee')[0]?.name === 'filter' &&
    selected?.name === 'nonNull' &&
    targets(graph, map, 'callee')[0]?.name === 'map'
  );
}

function localMapperReturn(graph: ProfileGraph, file: string): boolean {
  const owner = profileMethod(graph, file, 'create')[0];
  const mapperType = file.replace('Factory', 'Mapper');
  const declarations = profileMethod(graph, mapperType, 'to');
  const target = declarations[0];
  if (!owner || declarations.length !== 1 || !target) return false;
  return graph.calls.some((call) => {
    if (call.caller !== owner.source || call.methodName !== 'to') return false;
    const selected = graph.bySource.get(call.call);
    return (
      call.receiverType?.endsWith(`.${mapperType}`) === true &&
      targets(graph, selected, 'argument').length === targets(graph, target, 'parameter').length &&
      profileReturned(graph, owner, call.call)
    );
  });
}

/** Customer/list/factory source composition, independently of successful external execution. */
export function profileCorporateComposition(
  document: ScanDocument,
): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  const owner = profileMethod(graph, 'CustomerFactory', 'mapCreate')[0];
  const clauses = {
    requestVariantDispatch: factoryDispatch(graph),
    nullFilteredListMapping: listMapping(graph),
    corporateEntitiesInCustomer: owner !== undefined && creationResult(graph, owner),
    fleetMappedReturn: localMapperReturn(graph, 'FleetCorporateEntityFactory'),
    partnerMappedReturn: localMapperReturn(graph, 'PartnerCorporateEntityFactory'),
  };
  return { ...clauses, supported: Object.values(clauses).every(Boolean) };
}
