import type { Core } from '@/application/plan/derive-core';
import { consumersIn, type createEdges } from '@/application/plan/derive-edges';
import type { Owners } from '@/application/plan/derive-owners';
import { memo, str, uniq } from '@/application/plan/derive-values';
import { actingService } from '@/application/plan/graph-queries';
import { parentOf, prop, typeOf } from '@/application/plan/ids';
import type { Concept, Stage } from '@/domain/plan/plan.generated';

export interface DomainLink {
  from: string;
  to: string;
  via: string[];
  kinds: ('msg' | 'api')[];
  same: boolean;
}

const writes = (mode: string | undefined): boolean => (mode ?? '').includes('write');

interface StageIndex {
  index: Map<string, number>;
  bySvc: Map<string, string>;
  byFlow: Map<string, string>;
}

function stageIndexOf(stages: readonly Stage[]): StageIndex {
  const bySvc = new Map<string, string>();
  const byFlow = new Map<string, string>();
  for (const st of stages) {
    for (const x of st.services ?? []) if (!bySvc.has(x.svc)) bySvc.set(x.svc, st.id);
    for (const f of st.flows ?? []) if (!byFlow.has(f)) byFlow.set(f, st.id);
  }
  return { index: new Map(stages.map((x, i) => [x.id, i])), bySvc, byFlow };
}

/** The stage with most of a flow's acting services; on a tie the earlier stage. */
function busiestStage(count: ReadonlyMap<string, number>, index: ReadonlyMap<string, number>) {
  let best: [string, number] | null = null;
  for (const [st, n] of count) {
    const earlier =
      best !== null && n === best[1] && (index.get(st) ?? 0) < (index.get(best[0]) ?? 0);
    if (best === null || n > best[1] || earlier) best = [st, n];
  }
  return best?.[0] ?? null;
}

/** A flow's authored stage, else the stage of the service that acts in most of its steps. */
function flowStageOf({ asIs, toBe }: Core, ix: StageIndex, fid: string): string | null {
  const authored = ix.byFlow.get(fid);
  if (authored !== undefined) return authored;
  const g = asIs.has(fid) ? asIs : toBe;
  const flow = g.get(fid);
  const count = new Map<string, number>();
  for (const step of flow?.$type === 'flow' ? flow.steps : []) {
    const st = ix.bySvc.get(actingService(g, step) ?? '');
    if (st !== undefined) count.set(st, (count.get(st) ?? 0) + 1);
  }
  return busiestStage(count, ix.index);
}

/**
 * stageOf(id) → stage id for a service (authored), a flow (authored in stage.flows, else the stage of the
 * service that acts in most of its steps), a step (its flow) or anything owned by a service.
 */
function buildDomain(core: Core, owners: Owners) {
  const { plan, asIs, toBe, graphOf } = core;
  const concepts: Concept[] = plan.domain?.concepts ?? [];
  const stages: Stage[] = plan.domain?.stages ?? [];
  const ix = stageIndexOf(stages);
  const flowStage = memo((fid: string): string | null => flowStageOf(core, ix, fid));
  const stageOf = (id: string): string | null => {
    const t = typeOf(id);
    if (t === 'service') return ix.bySvc.get(id) ?? null;
    if (t === 'flow') return flowStage(id);
    if (t === 'step') return flowStage(parentOf(id) ?? '');
    const o = owners.ownerService(id);
    return o === null ? null : (ix.bySvc.get(o) ?? null);
  };
  return {
    summary: plan.domain?.summary ?? '',
    concepts,
    stages,
    stageIndex: (id: string): number => ix.index.get(id) ?? -1,
    stageOf,
    roleOf: (id: string): string | null => str(prop(asIs.get(id) ?? toBe.get(id), 'does')) ?? null,
    flowsIn: (stageId: string, mode = 'asIs'): string[] =>
      graphOf(mode)
        .flows.filter((f) => stageOf(f.id) === stageId)
        .map((f) => f.id),
    /** Concepts that relate to `cid` (incoming part_of / relates). */
    relatedTo: (cid: string): Concept[] =>
      concepts.filter(
        (c) => c.id !== cid && (c.part_of === cid || (c.relates ?? []).some((r) => r.to === cid)),
      ),
  };
}

type Domain = ReturnType<typeof buildDomain>;
type Graph = ReturnType<Core['graphOf']>;

interface Links {
  msg: (a: string, b: string, via: string) => void;
  api: (a: string, b: string, via: string | null) => void;
  list: () => DomainLink[];
}

/** Links between stages, merged by their two ends and oriented from the earlier stage to the later. */
function linkSet(dm: Domain): Links {
  const links = new Map<string, DomainLink>();
  const put = (a: string, b: string, [via, kind]: [string | null, 'msg' | 'api']): void => {
    const sa = dm.stageOf(a);
    const sb = dm.stageOf(b);
    if (sa === null || sb === null || a === b) return;
    const [from, to] = dm.stageIndex(sa) <= dm.stageIndex(sb) ? [a, b] : [b, a];
    const key = `${from}|${to}`;
    const link = links.get(key) ?? { from, to, via: [], kinds: [], same: sa === sb };
    links.set(key, link);
    if (via !== null && !link.via.includes(via)) link.via.push(via);
    if (!link.kinds.includes(kind)) link.kinds.push(kind);
  };
  return {
    msg: (a, b, via) => {
      put(a, b, [via, 'msg']);
    },
    api: (a, b, via) => {
      put(a, b, [via, 'api']);
    },
    list: () => [...links.values()],
  };
}

const writersOf = (n: {
  owner: string;
  access?: { svc: string; mode: string }[] | undefined;
}): string[] =>
  uniq([n.owner, ...(n.access ?? []).filter((a) => writes(a.mode)).map((a) => a.svc)]);

/** Topics also say who writes (owner, write access) and who reads, even where no message is modelled. */
function topicLinks(g: Graph, { msg }: Links): void {
  for (const t of g.stores.filter((s) => s.kind === 'topic' || s.kind === 'queue')) {
    const readers = (t.access ?? []).filter((a) => a.mode.includes('read')).map((a) => a.svc);
    for (const w of writersOf(t)) for (const r of readers.filter((x) => x !== w)) msg(w, r, t.id);
  }
}

/** An authored "reads from" on a stage service: a topic links its writers, an interface or endpoint its service. */
function authoredLink(g: Graph, { msg, api }: Links, [src, svc]: readonly [string, string]): void {
  const n = g.get(src);
  switch (n?.$type) {
    case 'service': {
      api(src, svc, null);
      break;
    }
    case 'store': {
      for (const w of writersOf(n)) msg(w, svc, src);
      break;
    }
    case 'interface': {
      api(n.service, svc, src);
      break;
    }
    case 'endpoint': {
      const i = g.get(n.$parent ?? '');
      if (i?.$type === 'interface') api(i.service, svc, i.id);
      break;
    }
    default: {
      break;
    }
  }
}

const authoredPairs = (stages: readonly Stage[]): (readonly [string, string])[] =>
  stages
    .flatMap((st) => st.services ?? [])
    .flatMap((x) => (x.from ?? []).map((src) => [src, x.svc] as const));

type Edges = Pick<ReturnType<typeof createEdges>, 'edgesOfGraph'>;

/** Service-to-service links in a graph: events through their topic, calls between caller and callee. */
function linksOf(core: Core, [dm, edges]: [Domain, Edges], mode: string | undefined): DomainLink[] {
  const g = core.graphOf(mode);
  const links = linkSet(dm);
  for (const m of g.messages) {
    for (const c of consumersIn(g, m.id))
      links.msg(m.producer, c.svc, g.has(m.topic) ? m.topic : m.id);
  }
  topicLinks(g, links);
  for (const pair of authoredPairs(dm.stages)) authoredLink(g, links, pair);
  for (const e of edges.edgesOfGraph(g === core.asIs ? 'asIs' : 'toBe')) {
    if (e.kind === 'api') links.api(e.from, e.to, g.get(e.via ?? '')?.$parent ?? e.via);
  }
  return links.list();
}

/** The plan's domain: authored concepts and stages, plus where each service and flow sits. */
export function createDomain(core: Core, owners: Owners, edges: Edges) {
  const domain = memo(() => buildDomain(core, owners));

  /**
   * Service-to-service links that carry data between stages, oriented from the earlier stage to the later.
   * Events link producer → consumer through their topic; calls link caller and callee.
   */
  const domainLinks = memo((mode: string | undefined = 'asIs'): DomainLink[] => {
    const dm = domain();
    return dm.stages.length === 0 ? [] : linksOf(core, [dm, edges], mode);
  });

  return { domain, domainLinks };
}
