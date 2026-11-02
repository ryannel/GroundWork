import type { SemanticNode } from '@/domain/scan/scan.generated';

import type { DepthResult } from './scan-benchmark-depth-facts';
import {
  args,
  awaited,
  before,
  derivedFromJson,
  guarded,
  hasCall,
  inRole,
  jsxAttribute,
  nextResult,
  nativeButton,
  nodeOwner,
  propertyValue,
  terminal,
  propertyElement,
  boundIdentifier,
  boundCallback,
} from './scan-depth-next-query';
import { expressionSpelling } from './scan-semantic-expression';
import {
  descendants,
  fieldValue,
  namedFunction,
  ownedNodes,
  targets,
  type SemanticGraph,
} from './scan-semantic-query';

export function addressWire(graph: SemanticGraph, id: string): DepthResult {
  const changed = namedFunction(graph, 'handlePlaceChanged');
  const selected = namedFunction(graph, 'handleSelect');
  const input = namedFunction(graph, 'AddressInput');
  const step = namedFunction(graph, 'StepAddress');
  const select = hasCall(graph, nodeOwner(changed), 'onSelectAction');
  const fetch = hasCall(graph, nodeOwner(selected), 'fetch');
  const options = args(graph, fetch)[1];
  const body = propertyValue(graph, options, 'body');
  const payload = args(graph, body)[0];
  const placePayload = args(graph, select)[0];
  const placeGuard = guarded(graph, nodeOwner(changed), '!place.geometry?.location');
  const autoGuard = guarded(graph, nodeOwner(changed), '!autocomplete');
  const binding = jsxAttribute(graph, nodeOwner(step), 'onSelectAction', 'handleSelect');
  const callback = jsxAttribute(graph, nodeOwner(input), 'onPlaceChanged', 'handlePlaceChanged');
  return nextResult(
    id,
    {
      callbackBinding: validBindings(graph, [callback, binding, changed, selected]),
      callbackUnknown: targets(graph, callback, 'registration').some(
        (node) => node.authority === 'unresolved',
      ),
      guardsReturn: [autoGuard, placeGuard].every((branch) =>
        targets(graph, branch, 'consequent').some(
          (node) => terminal(graph, node)?.nodeKind === 'return',
        ),
      ),
      guardOrder: before(graph, autoGuard, select) && before(graph, placeGuard, select),
      placeFields:
        expressionSpelling(graph, propertyValue(graph, placePayload, 'address')) ===
          'place.formatted_address??""' &&
        ['address', 'lat', 'lng'].every(
          (name) => propertyValue(graph, placePayload, name) !== undefined,
        ),
      placeSelectors:
        expressionSpelling(graph, propertyValue(graph, placePayload, 'lat')) ===
          'place.geometry.location.lat()' &&
        expressionSpelling(graph, propertyValue(graph, placePayload, 'lng')) ===
          'place.geometry.location.lng()',
      request:
        args(graph, fetch)[0]?.value === '/api/ev-subsidy/eligibility' &&
        propertyValue(graph, options, 'method')?.value === 'POST',
      serialisation:
        expressionSpelling(graph, targets(graph, body, 'callee')[0]) === 'JSON.stringify',
      payloadOnly:
        targets(graph, payload, 'property').length === 2 &&
        expressionSpelling(graph, propertyValue(graph, payload, 'lat')) === 'location.lat' &&
        expressionSpelling(graph, propertyValue(graph, payload, 'lng')) === 'location.lng' &&
        ['lat', 'lng'].every((field) =>
          boundIdentifier(graph, propertyValue(graph, payload, field), 'location'),
        ),
    },
    [changed, selected, callback, binding, fetch, payload],
  );
}

export function addressResponse(graph: SemanticGraph, id: string): DepthResult {
  const selected = namedFunction(graph, 'handleSelect');
  const step = namedFunction(graph, 'StepAddress');
  const owner = nodeOwner(selected);
  const fetch = hasCall(graph, owner, 'fetch');
  const json = hasCall(graph, owner, 'res.json');
  const guard = guarded(graph, owner, '!res.ok');
  const update = hasCall(graph, owner, 'setIsEligible', ['data.eligible']);
  const failed = hasCall(graph, owner, 'setIsEligible', ['false']);
  const finished = hasCall(graph, owner, 'setLoading', ['false']);
  const attempt = ownedNodes(graph, owner, 'try')[0];
  const button = jsxAttribute(graph, nodeOwner(step), 'disabled', 'loading||isEligible!==true');
  const click = targets(graph, nativeButton(graph, button), 'property').find(
    (node) => node.name === 'onClick',
  );
  const clickFunction =
    targets(graph, fieldValue(graph, click), 'callback')[0] ??
    descendants(graph, click).find((node) => node.nodeKind === 'function');
  return nextResult(
    id,
    {
      responseWait:
        awaited(graph, fetch) &&
        awaited(graph, json) &&
        derivedFromJson(graph, args(graph, update)[0], json, 'data'),
      failureGuard:
        guard !== undefined &&
        targets(graph, guard, 'consequent').some(
          (node) => terminal(graph, node)?.nodeKind === 'throw',
        ),
      responseOrder:
        before(graph, fetch, guard) && before(graph, guard, json) && before(graph, json, update),
      catchAndFinally:
        inRole(graph, attempt, 'catch', failed) && inRole(graph, attempt, 'finally', finished),
      continueDisabled: button !== undefined,
      continueCallback: hasCall(graph, nodeOwner(clickFunction), 'onNextAction') !== undefined,
    },
    [fetch, json, guard, update, failed, finished, button, click],
  );
}

function validBindings(
  graph: SemanticGraph,
  nodes: readonly (SemanticNode | undefined)[],
): boolean {
  const [callback, binding, changed, selected] = nodes;
  return (
    propertyElement(graph, callback, 'Autocomplete') &&
    propertyElement(graph, binding, 'AddressInput') &&
    boundCallback(graph, callback, changed) &&
    boundCallback(graph, binding, selected)
  );
}
