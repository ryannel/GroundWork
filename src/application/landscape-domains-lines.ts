import type { MapLink } from './landscape-domains';
import type { LinkKind } from './landscape-map-input';

// The lines between the boxes on the map. Each runs from the right edge of the box further left to the left edge
// of the other, as a smooth curve; two boxes in one column loop round on the right. Where several lines meet a
// side they spread along it, in the order of where they come from, so they do not cross at the box.

export interface MapBox {
  readonly id: string;
  readonly kind: 'customer' | 'domain';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface MapLine {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  /** The strongest kind on it, which sets how it is drawn. */
  readonly kind: LinkKind;
  readonly d: string;
  /** Where its label sits. */
  readonly mx: number;
  readonly my: number;
  /** Arrows at the start and end of `d`. */
  readonly arrows: { readonly start: boolean; readonly end: boolean };
}

const LOOP = 64;
const INSET = 18;

interface Ends {
  readonly link: MapLink;
  /** Where the line starts and ends, and on which side of each box. */
  readonly from: MapBox;
  readonly to: MapBox;
  readonly loop: boolean;
}

const middle = (box: MapBox): number => box.y + box.h / 2;

function endsOf(links: readonly MapLink[], boxes: readonly MapBox[]): Ends[] {
  const at = new Map(boxes.map((b) => [b.id, b]));
  return links.flatMap((link): Ends[] => {
    const a = at.get(link.a);
    const b = at.get(link.b);
    if (a === undefined || b === undefined) return [];
    if (a.x === b.x) return [{ link, from: a, to: b, loop: true }];
    return [
      a.x < b.x ? { link, from: a, to: b, loop: false } : { link, from: b, to: a, loop: false },
    ];
  });
}

/** The height on its side of a box where each line meets it, keyed `<line>@<box>`. */
function portsOf(ends: readonly Ends[]): ReadonlyMap<string, number> {
  const sides = new Map<
    string,
    { readonly line: string; readonly box: MapBox; readonly other: number }[]
  >();
  const meet = (
    at: { readonly box: MapBox; readonly side: string },
    line: string,
    other: MapBox,
  ): void => {
    const key = `${at.box.id}:${at.side}`;
    sides.set(key, [...(sides.get(key) ?? []), { line, box: at.box, other: middle(other) }]);
  };
  for (const { link, from, to, loop } of ends) {
    meet({ box: from, side: 'right' }, link.id, to);
    meet({ box: to, side: loop ? 'right' : 'left' }, link.id, from);
  }
  const ports = new Map<string, number>();
  for (const list of sides.values()) {
    const sorted = list.toSorted((p, q) => p.other - q.other);
    for (const [i, { line, box }] of sorted.entries()) {
      const span = Math.max(0, box.h - 2 * INSET);
      ports.set(`${line}@${box.id}`, box.y + INSET + ((i + 1) * span) / (sorted.length + 1));
    }
  }
  return ports;
}

const n = (value: number): string => String(Math.round(value * 10) / 10);

function curveOf(end: Ends, ports: ReadonlyMap<string, number>) {
  const { link, from, to, loop } = end;
  const y1 = ports.get(`${link.id}@${from.id}`) ?? middle(from);
  const y2 = ports.get(`${link.id}@${to.id}`) ?? middle(to);
  const x1 = from.x + from.w;
  if (loop) {
    const out = x1 + LOOP;
    return {
      d: `M${n(x1)} ${n(y1)} C${n(out)} ${n(y1)} ${n(out)} ${n(y2)} ${n(x1)} ${n(y2)}`,
      mx: x1 + LOOP * 0.75,
      my: (y1 + y2) / 2,
    };
  }
  const x2 = to.x;
  const pull = (x2 - x1) / 2;
  return {
    d: `M${n(x1)} ${n(y1)} C${n(x1 + pull)} ${n(y1)} ${n(x2 - pull)} ${n(y2)} ${n(x2)} ${n(y2)}`,
    mx: (x1 + x2) / 2,
    my: (y1 + y2) / 2,
  };
}

/** Every line between two boxes on the map, curved and spread where they meet. */
export function linesOf(links: readonly MapLink[], boxes: readonly MapBox[]): MapLine[] {
  const ends = endsOf(links, boxes);
  const ports = portsOf(ends);
  return ends.map((end) => {
    const { link } = end;
    const startsAtA = end.from.id === link.a;
    return {
      id: link.id,
      a: link.a,
      b: link.b,
      kind: link.kinds[0] ?? 'api',
      ...curveOf(end, ports),
      arrows: startsAtA
        ? { start: link.back, end: link.forward }
        : { start: link.forward, end: link.back },
    };
  });
}
