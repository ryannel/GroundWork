import { plural } from '@/shared/text';

import type { LandscapeMapInput, MapDomain } from './landscape-map-input';
import { roomFor } from './landscape-map-path';
import { rollUp, shownBy } from './landscape-map-rollup';
import { routeLines } from './landscape-map-route';
import type { Box, LandDrawing, LandNode } from './landscape-map-types';

// The landscape as one canvas, in three bands: the people who use the systems along the top, the domains in
// the order work moves through them, and the outside services along the bottom. A folded domain is one box; an
// open one is a frame of its systems.

const SIZE = {
  pad: 24,
  person: { w: 184, h: 124 },
  domain: { w: 256, h: 176 },
  card: { w: 232, h: 112 },
  head: 72,
  inner: 16,
  gap: 80,
  band: 112,
} as const;

const PEOPLE_GAP = 16;

function folded(domain: MapDomain, x: number, y: number): LandNode {
  return {
    id: domain.id,
    kind: 'domain',
    x,
    y,
    ...SIZE.domain,
    eyebrow: `Domain · ${plural(domain.systems.length, 'system')}`,
    name: domain.name,
    text: domain.purpose,
    href: domain.href,
    teamSlot: 0,
    dots: [...new Set(domain.systems.map((s) => s.teamSlot))],
    domain: null,
  };
}

function opened(domain: MapDomain, x: number, y: number): LandNode[] {
  const { card, inner, head } = SIZE;
  const rows = Math.max(1, domain.systems.length);
  const frame: LandNode = {
    ...folded(domain, x, y),
    kind: 'frame',
    w: inner * 2 + card.w,
    h: head + rows * card.h + (rows - 1) * inner + inner,
    dots: [],
  };
  const cards = domain.systems.map((s, i): LandNode => ({
    id: s.id,
    kind: 'system',
    x: x + inner,
    y: y + head + i * (card.h + inner),
    ...card,
    eyebrow: `${plural(s.parts, 'part')} · system`,
    name: s.name,
    text: s.does === '' ? null : s.does,
    href: s.href,
    teamSlot: s.teamSlot,
    dots: [],
    domain: domain.id,
  }));
  return [frame, ...cards];
}

/** How much room the lines need: the gap left of each domain and right of the last, and each channel's height. */
interface Room {
  readonly gaps: readonly number[];
  readonly top: number;
  readonly bottom: number;
}

const ROOMY: Room = { gaps: [], top: SIZE.band, bottom: SIZE.band };

/** Room for as many lanes as the first drawing needed, and never less than the usual gap. */
function roomOf(needs: ReadonlyMap<string, number>, domains: number): Room {
  const at = (id: string, least: number): number => Math.max(least, roomFor(needs.get(id) ?? 0));
  return {
    gaps: Array.from({ length: domains + 1 }, (_, i) => at(`c${String(i)}`, SIZE.gap)),
    top: at('top', SIZE.band),
    bottom: at('bottom', SIZE.band),
  };
}

function domainRow(
  input: LandscapeMapInput,
  open: ReadonlySet<string>,
  { top, room }: { readonly top: number; readonly room: Room },
): LandNode[] {
  const gap = (i: number): number => room.gaps[i] ?? SIZE.gap;
  const nodes: LandNode[] = [];
  let x = gap(0);
  for (const [i, domain] of input.domains.entries()) {
    const drawn = open.has(domain.id) ? opened(domain, x, top) : [folded(domain, x, top)];
    nodes.push(...drawn);
    x += (drawn[0]?.w ?? 0) + gap(i + 1);
  }
  return nodes;
}

const centre = (box: Box): number => box.x + box.w / 2;
const rowWidth = (n: number): number => n * SIZE.person.w + Math.max(0, n - 1) * PEOPLE_GAP;

interface Band {
  readonly items: readonly { id: string; name: string; text: string | null }[];
  readonly kind: 'actor' | 'external';
  readonly eyebrow: string;
  readonly y: number;
}

/** A band of people or outside services, each as near as it can be to the boxes it connects to. */
function bandOf(band: Band, want: (id: string) => number, width: number): LandNode[] {
  const { w, h } = SIZE.person;
  const sorted = band.items
    .map((item, at) => ({ item, at, x: want(item.id) - w / 2 }))
    .toSorted((p, q) => (p.x === q.x ? p.at - q.at : p.x - q.x));
  let right = SIZE.pad - PEOPLE_GAP;
  const pushed = sorted.map((p) => {
    const x = Math.max(p.x, right + PEOPLE_GAP, SIZE.pad);
    right = x + w;
    return x;
  });
  let limit = width - SIZE.pad + PEOPLE_GAP;
  const xs = pushed.toReversed().map((x) => {
    const fitted = Math.min(x, limit - PEOPLE_GAP - w);
    limit = fitted;
    return fitted;
  });
  return sorted.toReversed().map(({ item }, i) => ({
    id: item.id,
    kind: band.kind,
    x: xs[i] ?? 0,
    y: band.y,
    w,
    h,
    eyebrow: band.eyebrow,
    name: item.name,
    text: item.text,
    href: null,
    teamSlot: 0,
    dots: [],
    domain: null,
  }));
}

function shifted(nodes: readonly LandNode[], dx: number): LandNode[] {
  return nodes.map((n) => ({ ...n, x: n.x + dx }));
}

/** Where each person or outside service would like to sit: under the middle of what it connects to. */
function wishes(input: LandscapeMapInput, open: ReadonlySet<string>, row: readonly LandNode[]) {
  const shown = shownBy(input, open);
  const at = new Map(row.map((n) => [n.id, centre(n)]));
  const near = new Map<string, number[]>();
  const note = (end: string, other: string): void => {
    const x = at.get(shown(other) ?? '');
    if (x !== undefined) near.set(end, [...(near.get(end) ?? []), x]);
  };
  for (const link of input.links) {
    note(link.from, link.to);
    note(link.to, link.from);
  }
  for (const e of input.externals) note(e.id, e.system);
  return (id: string): number => {
    const xs = near.get(id) ?? [];
    return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
  };
}

function drawWith(
  input: LandscapeMapInput,
  open: ReadonlySet<string>,
  room: Room,
): { drawing: LandDrawing; needs: ReadonlyMap<string, number> } {
  const { pad, person } = SIZE;
  const top = pad + person.h + room.top;
  const raw = domainRow(input, open, { top, room });
  const rowRight =
    Math.max(0, ...raw.map((n) => n.x + n.w)) + (room.gaps[input.domains.length] ?? SIZE.gap);
  const width = Math.max(
    rowRight,
    2 * pad + Math.max(rowWidth(input.actors.length), rowWidth(input.externals.length)),
  );
  const row = shifted(raw, (width - rowRight) / 2);
  const rowBottom = Math.max(top, ...row.map((n) => n.y + n.h));
  const want = wishes(input, open, row);
  const people = bandOf(
    {
      items: input.actors.map((a) => ({ id: a.id, name: a.name, text: a.summary })),
      kind: 'actor',
      eyebrow: 'Person',
      y: pad,
    },
    want,
    width,
  );
  const outside = bandOf(
    {
      items: input.externals.map((e) => ({ id: e.id, name: e.name, text: e.does })),
      kind: 'external',
      eyebrow: 'Outside service',
      y: rowBottom + room.bottom,
    },
    want,
    width,
  );
  const nodes = [...people, ...row, ...outside];
  const height = rowBottom + room.bottom + (input.externals.length === 0 ? 0 : person.h) + pad;
  const { lines, needs } = routeLines(rollUp(input, open), nodes, width);
  return { drawing: { width, height, nodes, lines }, needs };
}

/** The whole canvas for the domains that are open, drawn once to count the lines' lanes and again with room
 * for them. */
export function drawLandscape(input: LandscapeMapInput, open: ReadonlySet<string>): LandDrawing {
  const first = drawWith(input, open, ROOMY);
  return drawWith(input, open, roomOf(first.needs, input.domains.length)).drawing;
}
