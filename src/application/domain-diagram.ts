import type { Model } from '@/application/plan/derive';
import type { Workspace } from '@/domain/workspace';
import { plural } from '@/shared/text';

import { layDiagram, type DiagramDraft, type DomainDiagram } from './domain-diagram-layout';
import { landscapeMapInput, type LandscapeMapInput, type LinkKind } from './landscape-map-input';

// A domain drawn at the size a newcomer can hold: its systems, the people who use them and the systems just outside,
// with every connection between components rolled up to one line between two boxes and counted.

export type { DiagramBox, DomainDiagram } from './domain-diagram-layout';

interface Tally {
  readonly from: string;
  readonly to: string;
  readonly kinds: ReadonlyMap<LinkKind, ReadonlySet<string>>;
}

const WORDS: Record<LinkKind, string> = { api: 'call', msg: 'event', data: 'store', use: '' };
const ORDER: readonly LinkKind[] = ['api', 'msg', 'data', 'use'];

function labelOf(kinds: ReadonlyMap<LinkKind, ReadonlySet<string>>): string {
  return ORDER.flatMap((kind) => {
    const seen = kinds.get(kind);
    if (seen === undefined || kind === 'use') return [];
    return [plural(seen.size, WORDS[kind])];
  }).join(' · ');
}

function tallies(input: LandscapeMapInput, here: ReadonlySet<string>): Tally[] {
  const actors = new Set(input.actors.map((a) => a.id));
  const homeOf = (id: string): string | null => input.homes[id] ?? (actors.has(id) ? id : null);
  const by = new Map<string, Tally>();
  const counted = (from: string, to: string): boolean =>
    from !== to && (here.has(from) || here.has(to));
  for (const link of input.links) {
    const from = homeOf(link.from);
    const to = homeOf(link.to);
    if (from === null || to === null || !counted(from, to)) continue;
    const key = `${from}>${to}`;
    const tally = by.get(key) ?? { from, to, kinds: new Map<LinkKind, ReadonlySet<string>>() };
    const seen = tally.kinds.get(link.kind) ?? new Set<string>();
    const kinds = new Map(tally.kinds);
    kinds.set(link.kind, new Set([...seen, `${link.from}>${link.to}>${link.via}`]));
    by.set(key, { from, to, kinds });
  }
  return [...by.values()];
}

function draftOf(input: LandscapeMapInput, domain: string, links: readonly Tally[]): DiagramDraft {
  const own = input.domains.find((d) => d.id === `domain:${domain}`);
  const touched = new Set(links.flatMap((l) => [l.from, l.to]));
  const others = input.domains
    .filter((d) => d !== own)
    .flatMap((d) => d.systems.map((s) => ({ s, where: d.name })));
  return {
    here: (own?.systems ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      does: s.does,
      href: s.href,
      slot: s.teamSlot,
    })),
    outside: others
      .filter(({ s }) => touched.has(s.id))
      .map(({ s, where }) => ({ id: s.id, name: s.name, does: where, href: s.href, slot: 0 })),
    actors: input.actors
      .filter((a) => touched.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, does: a.summary ?? '', href: null, slot: 0 })),
    links: links.map((l) => ({ from: l.from, to: l.to, label: labelOf(l.kinds) })),
  };
}

/** The domain's systems and their neighbours, laid out left to right in the way the work moves. */
export function domainDiagramOf(workspace: Workspace, model: Model, domain: string): DomainDiagram {
  const input = landscapeMapInput(workspace, model);
  const own = input.domains.find((d) => d.id === `domain:${domain}`);
  const here = new Set((own?.systems ?? []).map((s) => s.id));
  return layDiagram(draftOf(input, domain, tallies(input, here)));
}
