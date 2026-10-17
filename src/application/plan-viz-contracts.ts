import type { Model } from '@/application/plan/derive';
import type { Test } from '@/domain/plan/plan.generated';

// Who depends on whom: the pairs of services each contract test checks, and every link between two services.

export interface Pair {
  readonly consumer: string;
  readonly provider: string;
  readonly via: string;
}

export interface TestPair {
  readonly test: string;
  readonly consumer: string | null;
  readonly provider: string | null;
  readonly via: string | null;
}

const svcOf = (id: string): string | null => (id.startsWith('svc:') ? id : null);
const keyOf = (p: Pair): string => `${p.consumer}|${p.provider}|${p.via}`;

function nodeOf(model: Model, id: string) {
  return model.toBe.get(id) ?? model.asIs.get(id);
}

/** The calls a step makes through an operation: one per hop, client to gateway and gateway to each subgraph's service. */
function operationPairs(model: Model, stepId: string, via: string): Pair[] {
  const calls = model.fanoutOf(stepId)?.calls ?? [];
  return calls
    .filter((c) => c.from !== '' && c.to !== '' && c.from !== c.to)
    .map((c) => ({ consumer: c.from, provider: c.to, via: c.via ?? via }));
}

function eventPair(
  model: Model,
  step: { readonly from: string; readonly to: string; readonly via: string },
): Pair[] {
  const message = nodeOf(model, step.via);
  const consumer = svcOf(step.to) ?? svcOf(step.from);
  return consumer !== null && message?.$type === 'message'
    ? [{ consumer, provider: message.producer, via: step.via }]
    : [];
}

function callPair(model: Model, from: string, via: string): Pair[] {
  const provider = nodeOf(model, via)?.$service;
  return from !== '' && provider !== undefined ? [{ consumer: from, provider, via }] : [];
}

function stepPairs(model: Model, walked: string): Pair[] {
  const step = nodeOf(model, walked);
  if (step?.$type !== 'step') return [];
  if (step.via.startsWith('msg:')) return eventPair(model, step);
  if (step.via.startsWith('api:')) return callPair(model, step.from, step.via);
  return step.via.startsWith('gql:') ? operationPairs(model, step.id, step.via) : [];
}

/** A contract test may walk a subgraph: every gateway-to-that-subgraph call is then checked. */
function subgraphPairs(model: Model, walked: string): Pair[] {
  const sg = nodeOf(model, walked);
  if (sg?.$type !== 'subgraph') return [];
  const graph = nodeOf(model, sg.graph);
  if (graph?.$type !== 'graph') return [];
  const gateway = graph.gateway;
  const provider = sg.service;
  return model.operationsOn(walked).map((via) => ({ consumer: gateway, provider, via }));
}

function pairsOf(model: Model, t: Test): Pair[] {
  const walks = t.walks ?? [];
  const found = [
    ...walks.flatMap((w) => stepPairs(model, w)),
    ...walks.filter((w) => w.startsWith('sg:')).flatMap((w) => subgraphPairs(model, w)),
  ];
  return [...new Map(found.map((f) => [keyOf(f), f])).values()];
}

/** Consumer and provider for every contract-level test, from the steps it walks; a test that walks none of them has no pair. */
export function contractPairs(model: Model): TestPair[] {
  return (model.plan.tests ?? [])
    .filter((t) => t.level === 'contract')
    .flatMap((t): TestPair[] => {
      const pairs = pairsOf(model, t);
      if (pairs.length === 0) return [{ test: t.id, consumer: null, provider: null, via: null }];
      return pairs.map((p) => ({ test: t.id, ...p }));
    });
}

const live = (model: Model, id: string): boolean => {
  const status = model.status(id);
  return status !== 'removed' && status !== 'deprecated';
};

function messagePairs(model: Model): Pair[] {
  return model.toBe.messages
    .filter((m) => live(model, m.id))
    .flatMap((m) =>
      model
        .consumersEffective(m.id)
        .map((c) => ({ consumer: c.svc, provider: m.producer, via: m.id })),
    );
}

function callPairs(model: Model): Pair[] {
  const apis = model.toBe.endpoints
    .filter((e) => live(model, e.id) && e.$service !== undefined)
    .flatMap((e) =>
      model
        .callers(e.id)
        .filter((c) => c.from !== e.$service)
        .map((c) => ({ consumer: c.from, provider: e.$service ?? '', via: e.id })),
    );
  const ops = model.toBe.operations
    .filter((o) => live(model, o.id))
    .flatMap((o) => model.callers(o.id).flatMap((c) => operationPairs(model, c.step, o.id)));
  return [...apis, ...ops];
}

/** Every link between two services in the to-be system: an event, a call or an operation, once each. */
export function interfacePairs(model: Model): Pair[] {
  const all = [...messagePairs(model), ...callPairs(model)].filter(
    (p) => p.consumer !== '' && p.provider !== '',
  );
  return [...new Map(all.map((p) => [keyOf(p), p])).values()];
}

/**
 * The calls and events this plan adds or re-routes that no contract test covers: the one list behind both the contract
 * page and the coverage page. A call that runs today is not on it, even when a new flow reuses it.
 */
export function changedLinksWithoutTest(model: Model): Pair[] {
  return model
    .coverage()
    .gaps.connectionsWithoutContract.map((g) =>
      g.via.startsWith('msg:')
        ? { consumer: g.to, provider: g.from, via: g.via }
        : { consumer: g.from, provider: g.to, via: g.via },
    );
}

/** "call" for an endpoint or an operation, "event" for a message. */
export const linkWord = (via: string): 'call' | 'event' =>
  via.startsWith('msg:') ? 'event' : 'call';

export { keyOf as pairKey };
