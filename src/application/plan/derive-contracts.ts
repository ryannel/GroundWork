import type { Core } from '@/application/plan/derive-core';
import { memo } from '@/application/plan/derive-values';
import type { FanoutCall, StepNode, SystemGraph } from '@/domain/plan/plan-graph';
import type { Test } from '@/domain/plan/plan.generated';

interface UncontractedLink {
  from: string;
  to: string;
  via: string;
  step: string;
  flow: string | undefined;
  steps: string[];
  reason: 'added' | 'via-changed' | 'fanout-changed';
  subgraph?: string;
}

type Links = Map<string, UncontractedLink>;

interface Scope {
  core: Core;
  contract: Test[];
  viaChanged: Set<string | null>;
}

const walksAny = (t: Test, s: StepNode): boolean =>
  (t.walks ?? []).some((w) => w === s.id || w === s.$parent);

const callKey = (c: FanoutCall): string => `${c.from}|${c.to}|${c.via ?? ''}`;

/** Service at one end of a step (a store end counts as its owner). */
function endService(core: Core, g: SystemGraph, id: string): string | null {
  const n = g.get(id) ?? core.sys(id);
  if (n?.$type === 'service') return n.id;
  return n?.$type === 'store' ? n.owner : null;
}

function keep(out: Links, key: string, link: UncontractedLink): void {
  const seen = out.get(key);
  if (seen === undefined) out.set(key, link);
  else if (!seen.steps.includes(link.step)) seen.steps.push(link.step);
}

function contractCovers(t: Test, s: StepNode, c: FanoutCall): boolean {
  const walks = t.walks ?? [];
  const subgraph = c.subgraph ?? '';
  return walksAny(t, s) || walks.includes(s.via) || (subgraph !== '' && walks.includes(subgraph));
}

const callsBefore = (core: Core, s: StepNode): Set<string> => {
  const was = core.asIs.get(s.id);
  return new Set(
    was?.$type === 'step' ? core.fanout(core.asIs, was).calls.map((c) => callKey(c)) : [],
  );
};

/** A step on an operation: new client → gateway and gateway → subgraph pairs need a contract test. */
function operationLinks(sc: Scope, s: StepNode, out: Links): void {
  const { core } = sc;
  const added = core.status(s.id) === 'added';
  const fresh = added || sc.viaChanged.has(s.id);
  const before = callsBefore(core, s);
  const calls = core
    .fanout(core.toBe, s)
    .calls.filter((c) => c.via === s.via && c.from !== '' && c.to !== '' && c.from !== c.to)
    .filter((c) => fresh || !before.has(callKey(c)))
    .filter((c) => !sc.contract.some((t) => contractCovers(t, s, c)));
  for (const c of calls) {
    const reason = fresh ? 'via-changed' : 'fanout-changed';
    const link: UncontractedLink = {
      from: c.from,
      to: c.to,
      via: s.via,
      step: s.id,
      flow: s.$parent,
      steps: [s.id],
      reason: added ? 'added' : reason,
      ...(c.subgraph !== undefined && c.subgraph !== '' ? { subgraph: c.subgraph } : {}),
    };
    keep(out, callKey(c), link);
  }
}

/** A call that runs today is not new, even when a new flow reuses it. */
const runsToday = (core: Core, s: StepNode, [from, to]: [string, string]): boolean =>
  core.asIs.steps.some(
    (o) =>
      o.via === s.via &&
      endService(core, core.asIs, o.from) === from &&
      endService(core, core.asIs, o.to) === to,
  );

/** A new or re-routed cross-service api or msg step. */
function connectionLink(sc: Scope, s: StepNode, out: Links): void {
  const { core } = sc;
  if (!/^(?:api|msg):/.test(s.via)) return;
  const added = core.status(s.id) === 'added';
  if (!added && !sc.viaChanged.has(s.id)) return;
  const from = endService(core, core.toBe, s.from);
  const to = endService(core, core.toBe, s.to);
  if (from === null || to === null || from === to) return;
  if (sc.contract.some((t) => walksAny(t, s)) || runsToday(core, s, [from, to])) return;
  const link: UncontractedLink = {
    from,
    to,
    via: s.via,
    step: s.id,
    flow: s.$parent,
    steps: [s.id],
    reason: added ? 'added' : 'via-changed',
  };
  keep(out, `${from}|${to}|${s.via}`, link);
}

/** Cross-service links of new or re-routed steps that no contract test walks. */
export function createContracts(core: Core) {
  const sc: Scope = {
    core,
    contract: core.tests.filter((t) => t.level === 'contract'),
    viaChanged: new Set(
      core.records
        .filter((r) => r.kind === 'modify' && r.props.some((p) => p.prop === 'via'))
        .map((r) => r.target),
    ),
  };

  /** New or re-routed cross-service api or msg steps with no contract test walking the step or its flow. */
  const connectionsWithoutContract = memo((): UncontractedLink[] => {
    const out: Links = new Map();
    for (const s of core.toBe.steps) {
      if (s.via.startsWith('gql:')) operationLinks(sc, s, out);
      else connectionLink(sc, s, out);
    }
    return [...out.values()];
  });

  return { connectionsWithoutContract };
}
