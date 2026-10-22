import type { ConnectionKind, Workspace } from '@/domain/workspace';
import { systemLinks } from '@/domain/workspace-links';

import { systemHref } from './workspace-paths';

// The systems one step outside a domain or a system: those it calls, messages or reads from, and those that do
// the same to it. They are where its edge is, so a reader learns what it leans on and who leans on it.

export interface Neighbour {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  /** "Fulfilment domain"; empty when it shares the scope's domain, which the page already names. */
  readonly place: string;
  /** "calls and messages" */
  readonly how: string;
}

export interface Neighbours {
  /** What the scope reaches out to. */
  readonly reaches: readonly Neighbour[];
  /** What reaches into the scope. */
  readonly reachedBy: readonly Neighbour[];
}

const VERB: Record<ConnectionKind, string> = {
  api: 'calls',
  message: 'messages',
  data: 'shares data',
};

interface Near {
  readonly id: string;
  readonly via: readonly ConnectionKind[];
}

/** The systems next to a set of systems (by id, without `sys:`), each way. */
export function neighboursOf(workspace: Workspace, inside: ReadonlySet<string>): Neighbours {
  const links = systemLinks(workspace.domains);
  const near = (own: 'from' | 'to', other: 'from' | 'to'): Near[] =>
    links
      .filter((link) => inside.has(link[own]) && !inside.has(link[other]))
      .map((link) => ({ id: link[other], via: link.via }));
  return {
    reaches: namedOf(workspace, near('from', 'to'), inside),
    reachedBy: namedOf(workspace, near('to', 'from'), inside),
  };
}

// Two systems of the scope may both reach the same neighbour; it is listed once, with every way.
function namedOf(
  workspace: Workspace,
  list: readonly Near[],
  inside: ReadonlySet<string>,
): Neighbour[] {
  const ways = new Map<string, Set<ConnectionKind>>();
  for (const n of list) ways.set(n.id, new Set([...(ways.get(n.id) ?? []), ...n.via]));
  return workspace.domains
    .flatMap((domain) => domain.systems.map((system) => ({ domain, system })))
    .flatMap(({ domain, system }) => {
      const via = ways.get(system.id);
      if (via === undefined) return [];
      return [
        {
          id: system.id,
          name: system.name,
          href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
          place: domain.systems.some((s) => inside.has(s.id)) ? '' : `${domain.name} domain`,
          how: [...via].map((kind) => VERB[kind]).join(' and '),
        },
      ];
    });
}
