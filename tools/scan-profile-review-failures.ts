import type { ScanDocument, SemanticNode } from '@/domain/scan/scan.generated';

import { profileGraph, profileReceiver, type ProfileGraph } from './scan-profile-review-graph';
import { profileLocalNodes, profileNullReturn } from './scan-profile-review-local';
import { descendants, targets } from './scan-semantic-query';

function caughtBody(graph: ProfileGraph, nodes: readonly SemanticNode[], type: string) {
  return nodes
    .filter((node) => node.nodeKind === 'catch')
    .filter((node) =>
      targets(graph, targets(graph, node, 'parameter')[0], 'declared_type').some(
        (entry) => entry.name === type,
      ),
    )
    .flatMap((node) => targets(graph, node, 'body'))
    .flatMap((node) => descendants(graph, node));
}

function callee(graph: ProfileGraph, node: SemanticNode | undefined, name: string): boolean {
  return node?.nodeKind === 'call' && targets(graph, node, 'callee')[0]?.name === name;
}

function conditionCall(graph: ProfileGraph, node: SemanticNode | undefined, name: string): boolean {
  if (callee(graph, node, name)) return true;
  return node !== undefined && descendants(graph, node).some((child) => callee(graph, child, name));
}

function branchBody(graph: ProfileGraph, branch: SemanticNode): readonly SemanticNode[] {
  return targets(graph, branch, 'consequent').flatMap((node) => descendants(graph, node));
}

function nullBranch(graph: ProfileGraph, nodes: readonly SemanticNode[], method: string): boolean {
  return nodes
    .filter((node) => node.nodeKind === 'if')
    .some((branch) => {
      const condition = targets(graph, branch, 'condition')[0];
      return (
        condition?.operator === '==' &&
        conditionCall(graph, condition, method) &&
        targets(graph, condition, 'right').some(
          (node) => node.nodeKind === 'literal' && node.value === null,
        ) &&
        profileNullReturn(graph, branchBody(graph, branch))
      );
    });
}

function cdbFailures(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const nodes = profileLocalNodes(graph, 'CdbClient', 'getConsumer');
  const invalid = nodes
    .filter((node) => node.nodeKind === 'if')
    .some((branch) => {
      const condition = targets(graph, branch, 'condition')[0];
      return (
        condition?.operator === '!' &&
        conditionCall(graph, condition, 'isValid') &&
        profileNullReturn(graph, branchBody(graph, branch))
      );
    });
  const partial = nodes
    .filter((node) => node.nodeKind === 'if')
    .some((branch) => {
      const condition = targets(graph, branch, 'condition')[0];
      const body = branchBody(graph, branch);
      return (
        condition?.operator === '!' &&
        conditionCall(graph, condition, 'isEmpty') &&
        conditionCall(graph, condition, 'getErrors') &&
        !body.some((node) => ['return', 'throw'].includes(node.nodeKind))
      );
    });
  return {
    invalidResponseNull: invalid,
    nullField: nullBranch(graph, nodes, 'getValue'),
    restExceptionNull: profileNullReturn(graph, caughtBody(graph, nodes, 'RestClientException')),
    partialErrorsContinue: partial,
  };
}

function partnerFailures(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const nodes = profileLocalNodes(graph, 'CommercialPartnerClient', 'getActivePartnerByPartnerId');
  const rest = caughtBody(graph, nodes, 'RestClientException');
  const throws = rest
    .filter((node) => node.nodeKind === 'throw')
    .some((node) =>
      targets(graph, node, 'value').some(
        (value) => targets(graph, value, 'callee')[0]?.name === 'CommercialPartnerException',
      ),
    );
  return {
    restExceptionTranslated: throws,
    fieldAccessNull: profileNullReturn(graph, caughtBody(graph, nodes, 'FieldAccessException')),
    nullPartner: nodes
      .filter((node) => node.nodeKind === 'if')
      .some((branch) => {
        const condition = targets(graph, branch, 'condition')[0];
        return (
          condition?.operator === '==' &&
          targets(graph, condition, 'right').some(
            (node) => node.nodeKind === 'literal' && node.value === null,
          ) &&
          profileNullReturn(graph, branchBody(graph, branch))
        );
      }),
  };
}

function volvoService(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const nodes = profileLocalNodes(graph, 'VolvoIdService', 'getVolvoIdUser');
  const empty = (body: readonly SemanticNode[]) =>
    body
      .filter((node) => node.nodeKind === 'return')
      .some((node) =>
        targets(graph, node, 'returns').some((value) => callee(graph, value, 'empty')),
      );
  const blank = nodes
    .filter((node) => node.nodeKind === 'if')
    .some((branch) => {
      const condition = targets(graph, branch, 'condition')[0];
      return (
        condition?.operator === '!' &&
        conditionCall(graph, condition, 'hasText') &&
        empty(branchBody(graph, branch))
      );
    });
  const sanitize = nodes.find((node) => callee(graph, node, 'sanitizeUser'));
  const lookup = targets(graph, sanitize, 'argument')[0];
  const sanitizer = profileLocalNodes(graph, 'VolvoIdService', 'sanitizeUser');
  return {
    blankTokenEmpty: blank,
    caughtExceptionEmpty: empty(caughtBody(graph, nodes, 'Exception')),
    lookupIntoSanitizer: callee(graph, lookup, 'getUserInfo'),
    sanitizerFieldClears: ['givenName', 'familyName', 'address'].every((name) =>
      sanitizer.some(
        (node) =>
          callee(graph, node, name) &&
          targets(graph, node, 'argument').some(
            (value) => value.nodeKind === 'literal' && value.value === null,
          ) &&
          callee(graph, profileReceiver(graph, node), 'toBuilder'),
      ),
    ),
  };
}

export function profileFailures(document: ScanDocument): {
  readonly cdb: Readonly<Record<string, boolean>>;
  readonly partner: Readonly<Record<string, boolean>>;
  readonly volvo: Readonly<Record<string, boolean>>;
} {
  const graph = profileGraph(document);
  return { cdb: cdbFailures(graph), partner: partnerFailures(graph), volvo: volvoService(graph) };
}
