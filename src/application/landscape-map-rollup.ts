import type { LandscapeMapInput, LinkKind, MapPath } from './landscape-map-input';

// The canvas draws one line between two boxes however many connections run between what they hold. A
// connection ends at the box that shows its component: the system when its domain is open, the domain when it
// is folded, the outside service or person itself.

const STRENGTH: readonly LinkKind[] = ['use', 'api', 'msg', 'data'];
const NAMED = 2;

export interface Rolled {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  readonly kind: LinkKind;
  readonly kinds: readonly LinkKind[];
  readonly forward: boolean;
  readonly back: boolean;
  readonly label: string;
}

/** Which box shows a component, an actor or a system, given the open domains; null when none does. */
export function shownBy(
  input: LandscapeMapInput,
  open: ReadonlySet<string>,
): (id: string) => string | null {
  const domainOf = new Map(input.domains.flatMap((d) => d.systems.map((s) => [s.id, d.id])));
  const ends = new Set([...input.actors, ...input.externals].map((x) => x.id));
  return (id) => {
    if (ends.has(id)) return id;
    const system = domainOf.has(id) ? id : input.homes[id];
    const domain = system === undefined ? undefined : domainOf.get(system);
    if (system === undefined || domain === undefined) return null;
    return open.has(domain) ? system : domain;
  };
}

const lineId = (x: string, y: string): string => (x < y ? `${x}|${y}` : `${y}|${x}`);

/** "A", "A and B", "A, B and 3 more". */
export function viaLabel(names: readonly string[]): string {
  const shown = names.slice(0, NAMED);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(', ')} and ${String(more)} more`;
  return shown.join(' and ');
}

interface Gathering {
  a: string;
  b: string;
  kinds: Set<LinkKind>;
  forward: boolean;
  back: boolean;
  vias: Set<string>;
}

/** Every connection rolled up to the boxes showing its ends, one per pair, in the order first met. */
export function rollUp(input: LandscapeMapInput, open: ReadonlySet<string>): Rolled[] {
  const shown = shownBy(input, open);
  const lines = new Map<string, Gathering>();
  for (const link of input.links) {
    const from = shown(link.from);
    const to = shown(link.to);
    if (from === null || to === null || from === to) continue;
    const id = lineId(from, to);
    const [a, b] = from < to ? [from, to] : [to, from];
    const line = lines.get(id) ?? {
      a,
      b,
      kinds: new Set(),
      forward: false,
      back: false,
      vias: new Set(),
    };
    line.kinds.add(link.kind);
    if (from === a) line.forward = true;
    else line.back = true;
    if (link.via !== '') line.vias.add(link.via);
    lines.set(id, line);
  }
  return [...lines].map(([id, line]) => {
    const kinds = STRENGTH.filter((k) => line.kinds.has(k));
    return {
      id,
      a: line.a,
      b: line.b,
      kind: kinds[0] ?? 'api',
      kinds,
      forward: line.forward,
      back: line.back,
      label: viaLabel([...line.vias]),
    };
  });
}

/** The lines a journey or flow runs along, with the line from the person who starts it. */
export function pathLines(
  input: LandscapeMapInput,
  open: ReadonlySet<string>,
  path: MapPath,
): ReadonlySet<string> {
  const shown = shownBy(input, open);
  const ids = new Set<string>();
  const add = (x: string, y: string): void => {
    const from = shown(x);
    const to = shown(y);
    if (from !== null && to !== null && from !== to) ids.add(lineId(from, to));
  };
  const first = path.pairs[0];
  if (path.actor !== null && first !== undefined) add(path.actor, first[0]);
  for (const [x, y] of path.pairs) add(x, y);
  return ids;
}

/** The boxes a path's lines touch. */
export function pathBoxes(lines: ReadonlySet<string>): ReadonlySet<string> {
  return new Set([...lines].flatMap((id) => id.split('|')));
}
