import type { Model } from '@/application/plan/derive';
import { todayJourneysOf } from '@/application/today-journeys';
import { journeyHref } from '@/application/today-reader';
import type { Workspace } from '@/domain/workspace';

import {
  actorIdOf,
  landscapeMapInput,
  type LandscapeMapInput,
  type LinkKind,
} from './landscape-map-input';

// The map rolls the workspace up to domains: each domain with the people who work in it, the customer apart, and
// one line for everything that runs between two of them. A person works in the domains whose systems they use;
// their journeys are the user journeys and flows they start.

export interface MapPerson {
  readonly id: string;
  readonly name: string;
  readonly summary: string | null;
  readonly customer: boolean;
  /** The domains they work in, or use as a customer, by `domain:` id. */
  readonly domains: readonly string[];
}

export interface MapDomain {
  readonly id: string;
  readonly name: string;
  readonly purpose: string | null;
  readonly href: string;
  readonly systems: number;
  /** The people who work in it, by `actor:` id; never the customer. */
  readonly people: readonly string[];
}

/** Everything between two domains, or from the customer to a domain, as one line. */
export interface MapLink {
  /** `<a>|<b>`, the ends in order, whichever way things go. */
  readonly id: string;
  readonly a: string;
  readonly b: string;
  readonly kinds: readonly LinkKind[];
  /** Something goes from a to b; from b to a. */
  readonly forward: boolean;
  readonly back: boolean;
  /** What it carries, by name: the APIs, topics and stores. */
  readonly vias: readonly string[];
  /** a relies on b: it calls b, reads b's events or is a customer of b. Sets which sits left. */
  readonly leans: 'a' | 'b' | 'both';
}

export interface MapJourney {
  readonly key: string;
  readonly title: string;
  readonly kind: 'journey' | 'flow';
  readonly href: string;
  readonly actor: string | null;
  /** The domains it runs through, by `domain:` id. */
  readonly domains: readonly string[];
  /** The lines it runs along, by id. */
  readonly lines: readonly string[];
}

export interface DomainMap {
  readonly people: readonly MapPerson[];
  readonly domains: readonly MapDomain[];
  readonly links: readonly MapLink[];
  readonly journeys: readonly MapJourney[];
}

const STRENGTH: readonly LinkKind[] = ['use', 'api', 'msg', 'data'];

/** The box that shows a component, system or person on the map: its domain, or the customer; null for none. */
function placerOf(input: LandscapeMapInput): (id: string) => string | null {
  const domainOf = new Map(input.domains.flatMap((d) => d.systems.map((s) => [s.id, d.id])));
  const customers = new Set(input.actors.filter((a) => a.customer).map((a) => a.id));
  return (id) => {
    if (customers.has(id)) return id;
    return domainOf.get(input.homes[id] ?? id) ?? null;
  };
}

/** Plain string order (by code point), not the locale's. */
function codeOrder(x: string, y: string): number {
  const length = Math.min(x.length, y.length);
  for (let i = 0; i < length; i += 1) {
    const step = (x.codePointAt(i) ?? 0) - (y.codePointAt(i) ?? 0);
    if (step !== 0) return step;
  }
  return x.length - y.length;
}

/** The two ends in code-unit order, so a pair reads the same either way round. */
const endsOf = (x: string, y: string): readonly string[] => [x, y].toSorted(codeOrder);

export const lineIdOf = (x: string, y: string): string => endsOf(x, y).join('|');

interface Gathering {
  readonly a: string;
  readonly b: string;
  readonly kinds: ReadonlySet<LinkKind>;
  readonly vias: ReadonlySet<string>;
  readonly forward: boolean;
  readonly back: boolean;
  /** Who relies on whom, as ends: 'a', 'b'. */
  readonly leans: ReadonlySet<'a' | 'b'>;
}

const leaningOf = (leans: ReadonlySet<'a' | 'b'>): MapLink['leans'] => {
  if (leans.size === 2) return 'both';
  return leans.has('a') ? 'a' : 'b';
};

/** Who relies on whom: a caller on what it calls, a reader on the events it hears. */
const leanerOf = (kind: LinkKind, from: string, to: string): string => (kind === 'msg' ? to : from);

const NO_LINE: Gathering = {
  a: '',
  b: '',
  kinds: new Set(),
  vias: new Set(),
  forward: false,
  back: false,
  leans: new Set(),
};

/** One more link on the line between two places, from one to the other. */
function gathered(
  line: Gathering | undefined,
  link: LandscapeMapInput['links'][number],
  ends: { readonly from: string; readonly to: string },
): Gathering {
  const { from, to } = ends;
  const [a = from, b = to] = endsOf(from, to);
  const was = line ?? NO_LINE;
  const leaner: 'a' | 'b' = leanerOf(link.kind, from, to) === a ? 'a' : 'b';
  return {
    a,
    b,
    kinds: new Set([...was.kinds, link.kind]),
    vias: link.via === '' ? was.vias : new Set([...was.vias, link.via]),
    forward: was.forward || from === a,
    back: was.back || from !== a,
    leans: new Set([...was.leans, leaner]),
  };
}

function linksOf(input: LandscapeMapInput): MapLink[] {
  const place = placerOf(input);
  const lines = new Map<string, Gathering>();
  for (const link of input.links) {
    const from = place(link.from);
    const to = place(link.to);
    if (from === null || to === null || from === to) continue;
    const id = lineIdOf(from, to);
    lines.set(id, gathered(lines.get(id), link, { from, to }));
  }
  return [...lines].map(([id, line]) => ({
    id,
    a: line.a,
    b: line.b,
    kinds: STRENGTH.filter((k) => line.kinds.has(k)),
    forward: line.forward,
    back: line.back,
    vias: [...line.vias],
    leans: leaningOf(line.leans),
  }));
}

/** The domains among the boxes, once each, in the order met. */
const domainsIn = (boxes: readonly (string | null)[]): string[] => [
  ...new Set(boxes.flatMap((box) => (box?.startsWith('domain:') === true ? [box] : []))),
];

function peopleOf(input: LandscapeMapInput): MapPerson[] {
  const place = placerOf(input);
  return input.actors.map((actor) => {
    const used = input.links.filter((l) => l.from === actor.id).map((l) => place(l.to));
    return { ...actor, domains: domainsIn(used) };
  });
}

function journeysOf(workspace: Workspace, model: Model, input: LandscapeMapInput): MapJourney[] {
  const place = placerOf(input);
  const flows = new Map(model.asIs.flows.map((f) => [f.id, f]));
  return todayJourneysOf(model).map((journey) => {
    const actor = actorIdOf(workspace.actors, journey.actor);
    const steps = journey.flows.flatMap((id) => flows.get(id)?.steps ?? []);
    const ends = steps.map((s) => [place(s.from), place(s.to)] as const);
    const first = ends.find(([from]) => from !== null)?.[0] ?? null;
    const starts = actor === null || first === null ? [] : [[place(actor), first] as const];
    const lines = [...starts, ...ends].flatMap(([x, y]) =>
      x === null || y === null || x === y ? [] : [lineIdOf(x, y)],
    );
    return {
      key: journey.key,
      title: journey.title,
      kind: journey.kind,
      href: journeyHref(workspace.id, journey.key),
      actor,
      domains: domainsIn(ends.flat()),
      lines: [...new Set(lines)],
    };
  });
}

/** The workspace as the map draws it: domains, the people in them, the customer, and the lines between. */
export function domainMapOf(workspace: Workspace, model: Model): DomainMap {
  const input = landscapeMapInput(workspace, model);
  const people = peopleOf(input);
  return {
    people,
    domains: input.domains.map((d) => ({
      id: d.id,
      name: d.name,
      purpose: d.purpose,
      href: d.href,
      systems: d.systems.length,
      people: people.filter((p) => !p.customer && p.domains.includes(d.id)).map((p) => p.id),
    })),
    links: linksOf(input),
    journeys: journeysOf(workspace, model, input),
  };
}

const KIND_WORD: Record<LinkKind, string> = {
  use: 'uses',
  api: 'calls',
  msg: 'events',
  data: 'reads and writes',
};
const NAMED = 2;

/** What a line carries: "Offers API and prices.events", or "… and 3 more"; and in full, ends and kinds too. */
export function lineWordsOf(
  link: MapLink,
  name: (id: string) => string,
): { readonly short: string; readonly full: string } {
  const shown = link.vias.slice(0, NAMED);
  const more = link.vias.length - shown.length;
  const short = more > 0 ? `${shown.join(', ')} and ${String(more)} more` : shown.join(' and ');
  const [from, to] = link.forward ? [link.a, link.b] : [link.b, link.a];
  const ends = `${name(from)} ${link.forward && link.back ? 'and' : 'to'} ${name(to)}`;
  const kinds = link.kinds.map((k) => KIND_WORD[k]).join(', ');
  const via = link.vias.length === 0 ? '' : `. ${link.vias.join(', ')}`;
  return { short, full: `${ends}: ${kinds}${via}` };
}
