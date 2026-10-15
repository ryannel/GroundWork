import type { Component, ConnectionKind, Domain, System, Workspace } from '@/domain/workspace';
import { componentHomes, wiresOf, type Home, type Wire } from '@/domain/workspace-links';
import { plural } from '@/shared/text';

import {
  layoutDiagram,
  type Diagram,
  type DiagramEdgeInput,
  type DiagramNodeInput,
} from './workspace-diagram';
import { domainHref, systemHref, teamOf, workspaceHref } from './workspace-paths';

export interface Target {
  readonly label: string;
  /** The other system's page, or null inside this system. */
  readonly href: string | null;
  readonly via: ConnectionKind;
}

export interface ComponentRow {
  readonly id: string;
  readonly name: string;
  readonly type: Component['type'];
  readonly tech: string | null;
  readonly does: string | null;
  readonly talksTo: readonly Target[];
}

export interface SystemView {
  readonly trail: readonly { readonly label: string; readonly href: string }[];
  readonly name: string;
  /** Who runs the system. */
  readonly description: string;
  /** Short facts for the line under the description. */
  readonly facts: readonly string[];
  readonly repos: readonly string[];
  readonly components: readonly ComponentRow[];
  readonly diagram: Diagram;
}

interface Context {
  readonly workspace: Workspace;
  readonly system: System;
  readonly homes: ReadonlyMap<string, Home>;
}

export function systemViewOf(
  workspace: Workspace,
  path: { readonly domain: string; readonly system: string },
): SystemView | null {
  const domain = workspace.domains.find((candidate) => candidate.id === path.domain);
  const system = domain?.systems.find((candidate) => candidate.id === path.system);
  if (domain === undefined || system === undefined) return null;
  const context: Context = { workspace, system, homes: componentHomes(workspace.domains) };
  const team = teamOf(workspace, system.team);
  return {
    trail: [
      { label: workspace.name, href: workspaceHref(workspace.id) },
      { label: domain.name, href: domainHref(workspace.id, domain.id) },
    ],
    name: system.name,
    description: team === null ? 'No team runs this yet' : `Run by ${team.name}`,
    facts: [plural(system.components.length, 'component'), plural(system.repos.length, 'repo')],
    repos: system.repos,
    components: system.components.map((component) => ({
      id: component.id,
      name: component.name,
      type: component.type,
      tech: component.tech,
      does: component.does,
      talksTo: component.talksTo.map((connection) =>
        targetOf(context, connection.to, connection.via),
      ),
    })),
    diagram: diagramOf(context),
  };
}

function targetOf(context: Context, to: string, via: ConnectionKind): Target {
  const home = context.homes.get(to);
  const found = home === undefined ? null : find(context.workspace, home);
  const component = found?.system.components.find((candidate) => candidate.id === to);
  const label = component?.name ?? to;
  if (found === null || found.system.id === context.system.id) return { label, href: null, via };
  return {
    label: `${label} (${found.system.name})`,
    href: systemHref({
      workspace: context.workspace.id,
      domain: found.domain.id,
      system: found.system.id,
    }),
    via,
  };
}

function find(workspace: Workspace, home: Home): { domain: Domain; system: System } | null {
  const domain = workspace.domains.find((candidate) => candidate.id === home.domain);
  const system = domain?.systems.find((candidate) => candidate.id === home.system);
  return domain === undefined || system === undefined ? null : { domain, system };
}

interface Ends {
  readonly from: string;
  readonly to: string;
  readonly caller: string | null;
  readonly callee: string | null;
}

// A wire drawn on this system's diagram: from or to one of its components.
function endsOf(context: Context, own: ReadonlySet<string>, wire: Wire): Ends | null {
  const target = context.homes.get(wire.to)?.system;
  if (target === undefined) return null;
  if (wire.system === context.system.id) {
    return own.has(wire.to)
      ? { from: `c:${wire.component}`, to: `c:${wire.to}`, caller: null, callee: null }
      : { from: `c:${wire.component}`, to: `s:${target}`, caller: null, callee: target };
  }
  if (!own.has(wire.to)) return null;
  return { from: `s:${wire.system}`, to: `c:${wire.to}`, caller: wire.system, callee: null };
}

// Components in the middle; the systems that call in on the left, the systems they talk to on the right.
function diagramOf(context: Context): Diagram {
  const own = new Set(context.system.components.map((component) => component.id));
  const edges = new Map<string, { from: string; to: string; via: ConnectionKind[] }>();
  const callees = new Set<string>();
  const callers = new Set<string>();
  for (const wire of wiresOf(context.workspace.domains)) {
    const ends = endsOf(context, own, wire);
    if (ends === null) continue;
    if (ends.callee !== null) callees.add(ends.callee);
    if (ends.caller !== null) callers.add(ends.caller);
    const key = `${ends.from}>${ends.to}`;
    const edge = edges.get(key) ?? { from: ends.from, to: ends.to, via: [] };
    if (!edge.via.includes(wire.via)) edge.via.push(wire.via);
    edges.set(key, edge);
  }
  const systemNode = (id: string) => outsideNode(context, id);
  return layoutDiagram(
    [
      quietColumn(
        'callers',
        'Calls in',
        [...callers].filter((id) => !callees.has(id)).flatMap(systemNode),
      ),
      {
        id: context.system.id,
        label: context.system.name,
        href: null,
        quiet: false,
        nodes: context.system.components.map((component) => componentNode(context, component)),
      },
      quietColumn('callees', 'Talks to', [...callees].flatMap(systemNode)),
    ].filter((column) => column.nodes.length > 0 || column.id === context.system.id),
    [...edges.values()] satisfies DiagramEdgeInput[],
  );
}

function quietColumn(id: string, label: string, nodes: readonly DiagramNodeInput[]) {
  return { id, label, href: null, quiet: true, nodes };
}

function componentNode(context: Context, component: Component): DiagramNodeInput {
  return {
    id: `c:${component.id}`,
    label: component.name,
    detail: component.tech === null ? component.type : `${component.type} · ${component.tech}`,
    href: null,
    team: teamOf(context.workspace, context.system.team)?.colour ?? null,
    quiet: false,
  };
}

function outsideNode(context: Context, id: string): DiagramNodeInput[] {
  const domain = context.workspace.domains.find((candidate) =>
    candidate.systems.some((system) => system.id === id),
  );
  const system = domain?.systems.find((candidate) => candidate.id === id);
  if (domain === undefined || system === undefined) return [];
  return [
    {
      id: `s:${id}`,
      label: system.name,
      detail: domain.name,
      href: systemHref({ workspace: context.workspace.id, domain: domain.id, system: id }),
      team: teamOf(context.workspace, system.team)?.colour ?? null,
      quiet: true,
    },
  ];
}
