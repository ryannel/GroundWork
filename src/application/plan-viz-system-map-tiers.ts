import type { Model } from '@/application/plan/derive';
import type { MapEdgeIn, SystemMapInput } from '@/application/plan-viz-system-map-types';
import { systemsOf, type SystemTier, type Workspace } from '@/domain/workspace';

// The tier each system sits in on a domain's map. A person may say it in system.yaml (`tier:`); otherwise the
// model implies it: the system holding a graph's gateway is the gateway, a system serving a subgraph is
// forward-facing, a system nothing else calls or tells is a channel, and the rest are back end. Outside parties
// are drawn upstream on their own, whichever system keeps them.

interface Implied {
  readonly gateways: ReadonlySet<string>;
  readonly subgraphs: ReadonlySet<string>;
  readonly reached: ReadonlySet<string>;
  readonly reaching: ReadonlySet<string>;
}

function impliedOf(input: SystemMapInput, model: Model): Implied {
  const sysOf = new Map(input.services.map((s) => [s.id, s.system]));
  const home = (id: string | null | undefined): string[] => {
    const sys = id === null || id === undefined ? null : sysOf.get(id);
    return sys === null || sys === undefined ? [] : [sys];
  };
  const owner = new Map(input.stores.map((s) => [s.id, s.owner]));
  const unit = (id: string): string | null =>
    sysOf.get(id) ?? sysOf.get(owner.get(id) ?? '') ?? null;
  const between = input.edges
    .filter((e) => e.kind !== 'data')
    .map((e) => [unit(e.from), unit(e.to)] as const)
    .filter(([a, b]) => a !== null && b !== null && a !== b);
  return {
    gateways: new Set(model.asIs.graphs.flatMap((g) => home(g.gateway))),
    subgraphs: new Set(model.asIs.subgraphs.flatMap((sg) => home(sg.service))),
    reached: new Set(between.map(([, b]) => b ?? '')),
    reaching: new Set(between.map(([a]) => a ?? '')),
  };
}

function impliedTier(id: string, implied: Implied): SystemTier {
  if (implied.gateways.has(id)) return 'gateway';
  if (implied.subgraphs.has(id)) return 'forward';
  if (!implied.reached.has(id) && implied.reaching.has(id)) return 'channel';
  return 'backend';
}

/** The tier a person gave each system, by `sys:` id. */
function authoredTiers(workspace: Workspace): ReadonlyMap<string, SystemTier> {
  return new Map(
    systemsOf(workspace).flatMap((s) =>
      s.tier === null || s.tier === undefined ? [] : [[`sys:${s.id}`, s.tier] as const],
    ),
  );
}

/** The gateway asks every subgraph it composes, so its fan-out is drawn even where no flow walks it. */
function fanoutEdges(input: SystemMapInput, model: Model): MapEdgeIn[] {
  const known = new Set(input.edges.map((e) => `${e.from}>${e.to}`));
  return model.asIs.subgraphs.flatMap((sg) => {
    const gateway = model.asIs.graphs.find((g) => g.id === sg.graph)?.gateway;
    const to = sg.service;
    if (gateway === undefined || known.has(`${gateway}>${to}`)) return [];
    known.add(`${gateway}>${to}`);
    return [{ kind: 'api', from: gateway, to, via: sg.id, steps: [], read: false, write: false }];
  });
}

/** The map's input with each system's tier, and the gateway's calls to the subgraphs it composes. */
export function tieredMapInput(
  input: SystemMapInput,
  model: Model,
  workspace: Workspace,
): SystemMapInput {
  const fanout = fanoutEdges(input, model);
  const withFanout = { ...input, edges: [...input.edges, ...fanout] };
  const implied = impliedOf(withFanout, model);
  const authored = authoredTiers(workspace);
  const tiers = Object.fromEntries(
    input.systems.map((s) => [s.id, authored.get(s.id) ?? impliedTier(s.id, implied)]),
  );
  const labels = Object.fromEntries(
    fanout.flatMap((e) => (e.via === null ? [] : [[e.via, model.label(e.via)]])),
  );
  return { ...withFanout, tiers, labels: { ...input.labels, ...labels } };
}
