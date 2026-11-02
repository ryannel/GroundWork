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
  nodeOwner,
  propertyValue,
  terminal,
} from './scan-depth-next-query';
import { expressionSpelling } from './scan-semantic-expression';
import {
  descendants,
  includesNode,
  namedCalls,
  namedFunction,
  ownedNodes,
  targets,
  type SemanticGraph,
} from './scan-semantic-query';

export function incomeCallback(graph: SemanticGraph, id: string): DepthResult {
  const submit = namedFunction(graph, 'submitData');
  const step = namedFunction(graph, 'StepPersons');
  const submitCall = graph.nodes.find(
    (node) =>
      node.nodeKind === 'call' &&
      targets(graph, node, 'callee').some(
        (callee) => expressionSpelling(graph, callee) === 'submitData',
      ),
  );
  const click = graph.nodes.find(
    (node) => node.nodeKind === 'function' && node.owner === nodeOwner(submitCall),
  );
  const tracker = hasCall(graph, nodeOwner(click), 'tracker.customEvent');
  const fetch = hasCall(graph, nodeOwner(submit), 'fetch');
  const options = args(graph, fetch)[1];
  const body = propertyValue(graph, options, 'body');
  const payload = args(graph, body)[0];
  const disabled = jsxAttribute(graph, nodeOwner(step), 'disabled', 'hasEmptyFields||loading');
  const button = graph.nodes.find(
    (node) =>
      node.nodeKind === 'jsx_element' &&
      node.name === 'button' &&
      targets(graph, node, 'property').some((attribute) => attribute.id === disabled?.id),
  );
  const onClick = targets(graph, button, 'property').find((node) => node.name === 'onClick');
  return nextResult(
    id,
    {
      nativeButtonBinding:
        onClick !== undefined && descendants(graph, onClick).some((node) => node.id === click?.id),
      fireAndContinue:
        !awaited(graph, submitCall) &&
        !ownedNodes(graph, nodeOwner(click), 'return').some((node) =>
          includesNode(graph, node, submitCall),
        ) &&
        before(graph, submitCall, tracker),
      immediateTracker: targets(graph, targets(graph, click, 'body')[0], 'statement').length === 2,
      helperWait:
        awaited(graph, fetch) &&
        hasCall(graph, nodeOwner(submit), 'setLoading', ['true']) !== undefined,
      request:
        args(graph, fetch)[0]?.value === '/api/ev-subsidy/income' &&
        propertyValue(graph, options, 'method')?.value === 'POST',
      jsonBody:
        expressionSpelling(graph, targets(graph, body, 'callee')[0]) === 'JSON.stringify' &&
        targets(graph, payload, 'property').length === 2,
      payloadFields:
        expressionSpelling(graph, propertyValue(graph, payload, 'rows')) === 'rows' &&
        expressionSpelling(graph, propertyValue(graph, payload, 'childrenAmount')) ===
          'childrenAmount',
      disabledGuard: disabled !== undefined,
    },
    [click, submitCall, tracker, fetch, payload, disabled],
  );
}

export function incomeResponse(graph: SemanticGraph, id: string): DepthResult {
  const submit = namedFunction(graph, 'submitData');
  const owner = nodeOwner(submit);
  const guard = guarded(graph, owner, '!res.ok');
  const json = hasCall(graph, owner, 'res.json');
  const eligible = guarded(graph, owner, 'incomeSection.status==="eligible"');
  const calls = namedCalls(graph, owner, 'onNext');
  const filled = calls.find((node) => args(graph, node).length === 1);
  const empty = calls.find((node) => args(graph, node).length === 0);
  const payload = args(graph, filled)[0];
  const attempt = ownedNodes(graph, owner, 'try')[0];
  const fields = [
    'qualifiesForStartBonus',
    'adjustedIncome',
    'maxAdjustedIncome',
    'maxHouseholdIncome',
    'startBonusHouseholdIncome',
    'startBonusThreshold',
  ];
  return nextResult(
    id,
    {
      awaitedJson:
        awaited(graph, json) &&
        derivedFromJson(graph, targets(graph, eligible, 'condition')[0], json, 'incomeSection'),
      responseCheck:
        guard !== undefined &&
        targets(graph, guard, 'consequent').some(
          (node) => terminal(graph, node)?.nodeKind === 'throw',
        ) &&
        before(graph, guard, json),
      eligibleBranch:
        inRole(graph, eligible, 'consequent', filled) &&
        inRole(graph, eligible, 'otherwise', empty),
      sixDetails:
        targets(graph, payload, 'property').length === 6 &&
        fields.every(
          (field) =>
            expressionSpelling(graph, propertyValue(graph, payload, field)) ===
            `incomeSection.details.${field}`,
        ),
      catchOnlyLogs:
        inRole(graph, attempt, 'catch', hasCall(graph, owner, 'console.error')) &&
        !calls.some((node) => inRole(graph, attempt, 'catch', node)),
      finallyLoading: inRole(
        graph,
        attempt,
        'finally',
        hasCall(graph, owner, 'setLoading', ['false']),
      ),
    },
    [guard, json, eligible, filled, empty, payload, attempt],
  );
}
