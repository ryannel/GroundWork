import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import { teamIndex } from '@/application/plan-viz-teams';
import { domainHref, systemHref } from '@/application/workspace-paths';
import { systemDoes, type Actor, type Domain, type Workspace } from '@/domain/workspace';

// The workspace at component level: who uses the systems, the domains and their systems, the outside services, and
// every connection between components. The map rolls it up to domains; a domain's diagram to its systems.

export type LinkKind = 'use' | 'api' | 'msg' | 'data';

export interface MapActor {
  readonly id: string;
  readonly name: string;
  readonly summary: string | null;
  readonly customer: boolean;
}

export interface MapSystem {
  readonly id: string;
  readonly name: string;
  readonly does: string;
  readonly href: string;
  readonly team: string | null;
  readonly teamSlot: number;
  readonly parts: number;
}

export interface MapDomain {
  readonly id: string;
  readonly name: string;
  readonly purpose: string | null;
  readonly href: string;
  readonly systems: readonly MapSystem[];
}

export interface MapExternal {
  readonly id: string;
  readonly name: string;
  readonly does: string | null;
  /** The system that calls it on the workspace's behalf. */
  readonly system: string;
}

/** One connection between two components, or from an actor to the component they use. */
export interface MapLink {
  readonly from: string;
  readonly to: string;
  readonly kind: LinkKind;
  /** What it goes through, by name: an API, a topic, a store. */
  readonly via: string;
}

export interface LandscapeMapInput {
  readonly actors: readonly MapActor[];
  /** In the order work moves through them. */
  readonly domains: readonly MapDomain[];
  readonly externals: readonly MapExternal[];
  readonly links: readonly MapLink[];
  /** The `sys:` id each component sits in. */
  readonly homes: Readonly<Record<string, string>>;
}

const slug = (name: string): string => name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, '-');

/** The actor a flow names, by `actor:` id or matched to a listed actor by name, else made up from the name. */
export function actorIdOf(actors: readonly Actor[], name: string): string | null {
  if (name === '' || name === 'System') return null;
  if (name.startsWith('actor:')) return name;
  const known = actors.find((a) => a.name.toLowerCase() === name.toLowerCase());
  return known?.id ?? `actor:${slug(name)}`;
}

function actorsOf(workspace: Workspace, model: Model): MapActor[] {
  const listed = workspace.actors.map((a) => ({
    id: a.id,
    name: a.name,
    summary: a.summary,
    customer: a.customer,
  }));
  const named = model.asIs.flows.map((f) => f.actor ?? '');
  const known = new Set(listed.map((a) => a.id));
  const extra = [...new Set(named)].flatMap((name) => {
    const id = actorIdOf(workspace.actors, name);
    if (id === null || known.has(id)) return [];
    known.add(id);
    return [{ id, name: name.replace(/^actor:/u, ''), summary: null, customer: false }];
  });
  return [...listed, ...extra];
}

function actorLinks(workspace: Workspace, model: Model): MapLink[] {
  const listed = workspace.actors.flatMap((a) =>
    a.uses.map((to) => ({ from: a.id, to, kind: 'use' as const, via: '' })),
  );
  const started = model.asIs.flows.flatMap((f) => {
    const actor = actorIdOf(workspace.actors, f.actor ?? '');
    const first = f.steps[0];
    if (actor === null || first === undefined) return [];
    return [{ from: actor, to: first.from, kind: 'use' as const, via: f.name }];
  });
  return [...listed, ...started];
}

function viaName(model: Model, via: string | null, to: string): string {
  if (via === null) return model.label(to);
  const parent = prop(model.asIs.get(via), '$parent');
  const named = typeof parent === 'string' && model.asIs.has(parent) ? parent : via;
  return model.label(named);
}

function componentLinks(model: Model): MapLink[] {
  return model.edges('asIs', 'all').map((e) => ({
    from: e.from,
    to: e.to,
    kind: e.kind,
    via: viaName(model, e.via, e.kind === 'data' ? e.to : e.from),
  }));
}

/** Where a domain sits in the story: the mean stage of its services, or after every staged one. */
function stageRank(model: Model, domain: Domain): number {
  const dm = model.domain();
  const index = new Map(dm.stages.map((s, i) => [s.id, i]));
  const ranks = domain.systems
    .flatMap((s) => s.components)
    .map((c) => index.get(dm.stageOf(c.id) ?? ''))
    .filter((i) => i !== undefined);
  return ranks.length === 0 ? dm.stages.length : ranks.reduce((a, b) => a + b, 0) / ranks.length;
}

function domainOf(workspace: Workspace, model: Model, domain: Domain): MapDomain {
  return {
    id: `domain:${domain.id}`,
    name: domain.name,
    purpose: domain.purpose,
    href: domainHref(workspace.id, domain.id),
    systems: domain.systems.map((system) => ({
      id: `sys:${system.id}`,
      name: system.name,
      does: systemDoes(system),
      href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
      team: system.team,
      teamSlot: system.team === null ? 0 : teamIndex(model, system.team),
      parts: system.components.filter((c) => c.type !== 'external').length,
    })),
  };
}

/** Every person, domain, system and connection, from the workspace and its model of today. */
export function landscapeMapInput(workspace: Workspace, model: Model): LandscapeMapInput {
  const ordered = workspace.domains
    .map((domain, at) => ({ domain, at, rank: stageRank(model, domain) }))
    .toSorted((a, b) => (a.rank === b.rank ? a.at - b.at : a.rank - b.rank))
    .map(({ domain }) => domainOf(workspace, model, domain));
  const systems = workspace.domains.flatMap((d) => d.systems);
  const homes = Object.fromEntries(
    systems.flatMap((s) => s.components.map((c) => [c.id, `sys:${s.id}`])),
  );
  const externals = systems.flatMap((s) =>
    s.components
      .filter((c) => c.type === 'external')
      .map((c) => ({ id: c.id, name: c.name, does: c.does, system: `sys:${s.id}` })),
  );
  return {
    actors: actorsOf(workspace, model),
    domains: ordered,
    externals,
    links: [...actorLinks(workspace, model), ...componentLinks(model)],
    homes,
  };
}
