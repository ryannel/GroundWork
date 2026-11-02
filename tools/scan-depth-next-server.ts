import type { SemanticNode } from '@/domain/scan/scan.generated';

import type { DepthResult } from './scan-benchmark-depth-facts';
import {
  args,
  awaited,
  before,
  guarded,
  hasCall,
  nextResult,
  propertyValue,
  resolve,
} from './scan-depth-next-query';
import { expressionSpelling } from './scan-semantic-expression';
import {
  descendants,
  fieldValue,
  namedCalls,
  objectField,
  ownedNodes,
  targets,
  type SemanticGraph,
} from './scan-semantic-query';

function declaration(graph: SemanticGraph, owner: string, name: string): SemanticNode | undefined {
  return ownedNodes(graph, owner, 'declaration').find((node) => node.name === name);
}

function initialiser(graph: SemanticGraph, owner: string, name: string) {
  return fieldValue(graph, declaration(graph, owner, name));
}

export function serverLineage(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const request = hasCall(graph, owner, 'req.json');
  const fetches = namedCalls(graph, owner, 'fetch');
  const lookup = fetches.find(
    (node) =>
      expressionSpelling(graph, args(graph, node)[0]) ===
      `\`\${baseUrl}/api/v1/lookup/deso?lat=\${lat}&lon=\${lng}\``,
  );
  const eligibility = fetches.find(
    (node) =>
      expressionSpelling(graph, args(graph, node)[0]) ===
      `\`\${baseUrl}/api/v1/eligibility/status\``,
  );
  const lookupJson = hasCall(graph, owner, 'lookupRes.json');
  const eligibilityOptions = args(graph, eligibility)[1];
  const stringify = propertyValue(graph, eligibilityOptions, 'body');
  const payload = resolve(graph, args(graph, stringify)[0]);
  const geography = propertyValue(graph, payload, 'geography');
  const body = initialiser(graph, owner, 'body');
  const destructure = coordinateBinding(graph, owner);
  const numeric = guarded(graph, owner, 'typeoflat!=="number"||typeoflng!=="number"');
  return nextResult(
    id,
    {
      requestJson:
        awaited(graph, request) &&
        targets(graph, body, 'awaited').some((node) => node.id === request?.id),
      requestCoordinates:
        destructure !== undefined && numeric !== undefined && before(graph, numeric, lookup),
      lookupSelectors:
        lookup !== undefined &&
        descendants(graph, args(graph, lookup)[0])
          .filter((node) => ['lat', 'lng'].includes(node.name ?? ''))
          .every((node) => targets(graph, node, 'binds').length > 0),
      lookupWait:
        awaited(graph, lookup) &&
        awaited(graph, lookupJson) &&
        before(graph, lookup, lookupJson) &&
        lookupGet(graph, lookup),
      payloadSerialisation:
        expressionSpelling(graph, targets(graph, stringify, 'callee')[0]) === 'JSON.stringify',
      eligibilityPost: isPost(graph, eligibilityOptions) && awaited(graph, eligibility),
      fixedMonths: fixedMonths(graph, geography),
      codeSelectors:
        expressionSpelling(graph, resolve(graph, propertyValue(graph, geography, 'desoCode'))) ===
          'lookupData?.desoCode' &&
        expressionSpelling(graph, propertyValue(graph, geography, 'municipalityCode')) ===
          'lookupData.municipalityCode',
      lookupDataBinding: targets(graph, initialiser(graph, owner, 'lookupData'), 'awaited').some(
        (node) => node.id === lookupJson?.id,
      ),
    },
    [request, lookup, numeric, lookupJson, eligibility, payload, geography],
  );
}

function statusIn(graph: SemanticGraph, root: SemanticNode | undefined, status: string): boolean {
  return descendants(graph, root)
    .filter((node) => node.nodeKind === 'return')
    .some((returned) => {
      const call = targets(graph, returned, 'returns')[0];
      return (
        expressionSpelling(graph, targets(graph, call, 'callee')[0]) === 'NextResponse.json' &&
        expressionSpelling(graph, propertyValue(graph, args(graph, call)[1], 'status')) === status
      );
    });
}

export function serverOutput(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const api = guarded(graph, owner, '!apiKey');
  const numeric = guarded(graph, owner, 'typeoflat!=="number"||typeoflng!=="number"');
  const lookup = guarded(graph, owner, '!lookupRes.ok');
  const code = guarded(graph, owner, '!desoCode');
  const eligibility = guarded(graph, owner, '!eligibilityRes.ok');
  const attempt = ownedNodes(graph, owner, 'try')[0];
  const success = namedCalls(graph, owner, 'NextResponse.json').find(
    (node) => objectField(graph, args(graph, node)[0], 'eligible') !== undefined,
  );
  const eligibleValue = resolve(graph, propertyValue(graph, args(graph, success)[0], 'eligible'));
  const geography = initialiser(graph, owner, 'geographySection');
  const find = targets(graph, geography, 'callee')[0];
  const callback = targets(graph, geography, 'callback')[0] ?? args(graph, geography)[0];
  const predicate = targets(graph, callback, 'body')[0];
  return nextResult(
    id,
    {
      missingKey500: targets(graph, api, 'consequent').some((node) => statusIn(graph, node, '500')),
      invalidCoordinates400: targets(graph, numeric, 'consequent').some((node) =>
        statusIn(graph, node, '400'),
      ),
      lookupFailureStatus: targets(graph, lookup, 'consequent').some((node) =>
        statusIn(graph, node, 'lookupRes.status'),
      ),
      missingCode400: targets(graph, code, 'consequent').some((node) =>
        statusIn(graph, node, '400'),
      ),
      eligibilityFailureStatus: targets(graph, eligibility, 'consequent').some((node) =>
        statusIn(graph, node, 'eligibilityRes.status'),
      ),
      unexpectedCatch500: targets(graph, attempt, 'catch').some((node) =>
        statusIn(graph, node, '500'),
      ),
      successfulBody:
        success !== undefined &&
        targets(graph, args(graph, success)[0], 'property').length === 1 &&
        expressionSpelling(graph, eligibleValue) === 'geographySection?.status==="eligible"',
      sectionSelection:
        expressionSpelling(graph, find) === 'eligibilityData.sections.find' &&
        expressionSpelling(graph, predicate) === 's.id==="geography"',
      eligibilityJson:
        awaited(graph, hasCall(graph, owner, 'eligibilityRes.json')) &&
        targets(graph, initialiser(graph, owner, 'eligibilityData'), 'awaited').some(
          (node) => node.id === hasCall(graph, owner, 'eligibilityRes.json')?.id,
        ),
      outputReturned: ownedNodes(graph, owner, 'return').some((node) =>
        targets(graph, node, 'returns').some((value) => value.id === success?.id),
      ),
    },
    [api, numeric, lookup, code, eligibility, attempt, success, eligibleValue, geography],
  );
}

function isPost(graph: SemanticGraph, options: SemanticNode | undefined): boolean {
  return propertyValue(graph, options, 'method')?.value === 'POST';
}

function coordinateBinding(graph: SemanticGraph, owner: string): SemanticNode | undefined {
  return ownedNodes(graph, owner, 'declaration').find((node) => {
    const key = targets(graph, node, 'key')[0];
    const bindings = new Set(
      descendants(graph, key)
        .filter((binding) => binding.nodeKind === 'declaration')
        .map((binding) => binding.name),
    );
    return (
      ['lat', 'lng'].every((name) => bindings.has(name)) &&
      expressionSpelling(graph, fieldValue(graph, node)) === 'body'
    );
  });
}

function lookupGet(graph: SemanticGraph, lookup: SemanticNode | undefined): boolean {
  const method = propertyValue(graph, args(graph, lookup)[1], 'method');
  return method === undefined || method.value === 'GET';
}

function fixedMonths(graph: SemanticGraph, geography: SemanticNode | undefined): boolean {
  return (
    propertyValue(graph, geography, 'monthsAtAddress')?.value === 4 &&
    propertyValue(graph, geography, 'monthsInArea')?.value === 12
  );
}
