import type { DepthResult } from './scan-benchmark-depth-facts';
import { errorGuard } from './scan-depth-error-flow';
import { contextualRegistry, ordinaryError } from './scan-depth-go-dispatch';
import {
  argumentsAre,
  comesBefore,
  guardReturning,
  inBranch,
  nativeResult,
  returnWith,
  sameFile,
  unknownBoundary,
} from './scan-depth-native-query';
import { expressionSpelling } from './scan-semantic-expression';
import {
  includesNode,
  namedCalls,
  namedFunction,
  objectField,
  ownedNodes,
  targets,
  type SemanticGraph,
} from './scan-semantic-query';

function enqueueBeforeCommit(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const begin = namedCalls(graph, owner, 'c.dbPool.GetPgxPool().Begin')[0];
  const insert = namedCalls(graph, owner, 'c.client.InsertTx')[0];
  const commit = namedCalls(graph, owner, 'tx.Commit')[0];
  const deferred = ownedNodes(graph, owner, 'defer')[0];
  const rollback = targets(graph, deferred, 'deferred')[0];
  const guards = ownedNodes(graph, owner, 'if').filter(
    (node) =>
      guardReturning(graph, owner, 'err!=nil') !== undefined &&
      targets(graph, node, 'condition').some(
        (condition) => expressionSpelling(graph, condition) === 'err!=nil',
      ),
  );
  const beginGuard = guards.find(
    (guard) => comesBefore(graph, begin, guard) && comesBefore(graph, guard, deferred),
  );
  const insertGuard = guards.find((guard) => includesNode(graph, guard, insert));
  const commitReturn = returnWith(graph, owner, 'tx.Commit(ctx)');
  return nativeResult(
    id,
    [
      [
        'Begin ctx then error early return',
        argumentsAre(graph, begin, ['ctx']) &&
          beginGuard !== undefined &&
          errorGuard(graph, beginGuard, { call: begin, position: 1 }),
      ],
      [
        'defer rollback only after Begin success',
        expressionSpelling(graph, targets(graph, rollback, 'callee')[0]) === 'rollback' &&
          argumentsAre(graph, rollback, ['ctx', 'tx', 'c.logger']) &&
          comesBefore(graph, beginGuard, deferred),
      ],
      [
        'InsertTx ctx tx job nil error before Commit',
        argumentsAre(graph, insert, ['ctx', 'tx', 'job', 'nil']) &&
          errorGuard(graph, insertGuard, { call: insert, position: 1 }),
      ],
      [
        'InsertTx error branch follows defer and precedes Commit',
        comesBefore(graph, deferred, insertGuard) && comesBefore(graph, insertGuard, commitReturn),
      ],
      [
        'success returns actual commit result',
        commit !== undefined &&
          commitReturn !== undefined &&
          includesNode(graph, commitReturn, commit),
      ],
    ],
    [begin, beginGuard, deferred, insert, insertGuard, commitReturn],
  );
}

function enqueueDelivery(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const insert = namedCalls(graph, owner, 'c.client.InsertTx')[0];
  const commit = namedCalls(graph, owner, 'tx.Commit')[0];
  const fn = ownedNodes(graph, owner, 'function')[0];
  const configuration = graph.nodes.find(
    (node) =>
      node.nodeKind === 'object' &&
      sameFile(graph, fn, node) &&
      objectField(graph, node, 'MaxAttempts') !== undefined &&
      objectField(graph, node, 'JobTimeout') !== undefined,
  );
  const attempts = objectField(graph, configuration, 'MaxAttempts');
  const timeout = objectField(graph, configuration, 'JobTimeout');
  return nativeResult(
    id,
    [
      [
        'separate enqueue transaction completion',
        insert !== undefined && commit !== undefined && comesBefore(graph, insert, commit),
      ],
      [
        'one attempt configuration',
        targets(graph, attempts, 'value').some((value) => value.value === 1),
      ],
      [
        'five hour timeout configuration',
        targets(graph, timeout, 'value').some(
          (value) =>
            value.nodeKind === 'binary' &&
            value.operator === '*' &&
            expressionSpelling(graph, targets(graph, value, 'left')[0]) === '5' &&
            expressionSpelling(graph, targets(graph, value, 'right')[0]) === 'time.Hour',
        ),
      ],
      ['worker delivery unknown', unknownBoundary(graph, insert, 'delivery_unknown')],
    ],
    [insert, commit, configuration, attempts, timeout],
  );
}

const ERROR_WRAPPER = 'errors.Wrap';

const COLUMNS = [
  'pno12',
  'model_year',
  'spec_market',
  'local_edition_code',
  'policy_id',
  'rule_set_path',
];
const VALUES = [
  'policyRuleset.Car.Pno12.String()',
  'policyRuleset.Car.ModelYear',
  'policyRuleset.Car.SpecMarket',
  'policyRuleset.Car.LocalEditionCode',
  'policyRuleset.PolicyID',
  'policyRuleset.RulesetPath',
];

function sqlPositional(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const exec = namedCalls(graph, owner, 'tx.Exec')[0];
  const sql = targets(graph, exec, 'resource').find(
    (node) => node.nodeKind === 'sql' && node.name === 'policy_rulesets',
  );
  const columns = targets(graph, sql, 'property');
  const correct = COLUMNS.every((name, position) => {
    const column = columns.find((node) => node.nodeKind === 'sql_column' && node.name === name);
    const bindings = (graph.outgoing.get(column?.id ?? '') ?? []).filter(
      (edge) => edge.relation === 'column_binding',
    );
    return (
      bindings.length === 1 &&
      bindings[0]?.position === position + 1 &&
      bindings[0].label === `$${String(position + 1)}` &&
      expressionSpelling(graph, graph.byId.get(bindings[0].to)) === VALUES[position]
    );
  });
  return nativeResult(
    id,
    [['six column positional bindings', correct && columns.length === 6]],
    [exec, sql, ...columns],
  );
}

function stagedCommit(graph: SemanticGraph, owner: string, id: string): DepthResult {
  const create = graph.nodes.find((node) => node.nodeKind === 'function' && node.owner === owner);
  const update = namedFunction(graph, 'update');
  const outer = namedFunction(graph, 'Upsert');
  const outerOwner = functionOwner(graph, 'Upsert');
  const updateOwner = functionOwner(graph, 'update');
  const inner = namedCalls(graph, outerOwner, 'r.upsert')[0];
  const commit = namedCalls(graph, outerOwner, 'tx.Commit')[0];
  const commitGuard = ownedNodes(graph, outerOwner, 'if').find((guard) =>
    includesNode(graph, guard, commit),
  );
  const wrapped = namedCalls(graph, outerOwner, ERROR_WRAPPER).find((call) =>
    inBranch(graph, commitGuard, call),
  );
  return nativeResult(
    id,
    [
      ['create Exec error gates nil return', executionErrorGate(graph, owner)],
      ['update Exec error gates nil return', executionErrorGate(graph, updateOwner)],
      [
        'outer upsert error gates commit',
        inner !== undefined &&
          commit !== undefined &&
          comesBefore(graph, inner, commit) &&
          ownedNodes(graph, outerOwner, 'if').some(
            (guard) =>
              includesNode(graph, guard, inner) &&
              errorGuard(graph, guard, { call: inner, position: 0 }),
          ),
      ],
      [
        'commit error wrapped and returned',
        errorGuard(graph, commitGuard, { call: commit, position: 0, wrapper: ERROR_WRAPPER }) &&
          argumentsAre(graph, wrapped, ['err', '0']) &&
          ownedNodes(graph, outerOwner, 'return').some(
            (node) => inBranch(graph, commitGuard, node) && includesNode(graph, node, wrapped),
          ),
      ],
      ['create has no commit', namedCalls(graph, owner, 'tx.Commit').length === 0],
    ],
    [create, update, outer, inner, commit, commitGuard, wrapped],
  );
}

function executionErrorGate(graph: SemanticGraph, owner: string): boolean {
  const exec = namedCalls(graph, owner, 'tx.Exec')[0];
  const guard = guardReturning(graph, owner, 'err!=nil');
  const nilReturn = returnWith(graph, owner, 'nil');
  const wrap = namedCalls(graph, owner, ERROR_WRAPPER)[0];
  return (
    comesBefore(graph, exec, guard) &&
    comesBefore(graph, guard, nilReturn) &&
    inBranch(graph, guard, wrap) &&
    errorGuard(graph, guard, { call: exec, position: 1, wrapper: ERROR_WRAPPER })
  );
}

const CHECKS: Readonly<
  Record<string, (graph: SemanticGraph, owner: string, id: string) => DepthResult>
> = {
  'go-error-not-throw': ordinaryError,
  'go-contextual-registry': contextualRegistry,
  'go-insert-before-commit': enqueueBeforeCommit,
  'go-enqueue-not-delivery': enqueueDelivery,
  'go-sql-positional-bindings': sqlPositional,
  'go-staged-versus-committed': stagedCommit,
};

export function evaluateGoDepth(
  graph: SemanticGraph,
  owner: string,
  id: string,
): DepthResult | undefined {
  return CHECKS[id]?.(graph, owner, id);
}

function functionOwner(graph: SemanticGraph, name: string): string {
  return namedFunction(graph, name)?.owner ?? '';
}
