import type { Box } from '@/application/plan-viz-system-map-boxes';
import type { Columns } from '@/application/plan-viz-system-map-columns';
import type { Aggregate, Link } from '@/application/plan-viz-system-map-links';
import type { Merged } from '@/application/plan-viz-system-map-routes';
import type { LineKind } from '@/application/plan-viz-system-map-types';

// Which lines share a drawn line: a folded system's parts share its card, and a map read by tier draws one per pair.

interface Seen {
  readonly agg: Aggregate;
  readonly nodes: ReadonlyMap<string, Box>;
}

function startOf(seen: Seen, l: Link, row: string | null): Merged {
  const shown = (id: string): string => seen.nodes.get(id)?.id ?? id;
  const host = (id: string): string => seen.agg.hostOfSat.get(id) ?? id;
  return {
    key: `${l.kind}|${shown(l.a)}|${shown(l.b)}|${row ?? ''}`,
    kind: l.kind,
    kinds: new Set([l.kind]),
    a: l.a,
    b: l.b,
    shownA: shown(l.a),
    shownB: shown(l.b),
    hostA: shown(host(l.a)),
    hostB: shown(host(l.b)),
    row,
    vias: new Set(),
    flows: new Set(),
    parts: new Set(),
    read: false,
    write: false,
    noted: l.flags.has('hand') && !l.flags.has('walked'),
  };
}

function joined(prev: Merged, l: Link): Merged {
  return {
    ...prev,
    kinds: new Set([...prev.kinds, l.kind]),
    vias: new Set([...prev.vias, ...l.vias]),
    flows: new Set([...prev.flows, ...l.flows]),
    parts: new Set([...prev.parts, `${l.a}|${l.b}`]),
    read: prev.read || l.flags.has('read'),
    write: prev.write || l.flags.has('write'),
    noted: prev.noted && l.flags.has('hand') && !l.flags.has('walked'),
  };
}

/** The one who needs the data first: a caller, a listener, a reader. An event runs the other way, so it turns round. */
const leaning = (l: Link): Link => (l.kind === 'msg' ? { ...l, a: l.b, b: l.a } : l);

const RANK: Readonly<Record<LineKind, number>> = { api: 2, msg: 1, data: 0 };

/** Where a line runs, which turns round when a call outranks what was there. */
const pick = (m: Merged) => ({
  kind: m.kind,
  a: m.a,
  b: m.b,
  shownA: m.shownA,
  shownB: m.shownB,
  hostA: m.hostA,
  hostB: m.hostB,
});

/** One line for each pair of cards, from the one who needs the data to the one who has it; a call outranks the rest. */
function paired(seen: Seen, prevOf: (key: string) => Merged | undefined, raw: Link): Merged {
  const l = leaning(raw);
  const start = startOf(seen, l, null);
  const key = [start.shownA, start.shownB].toSorted((x, y) => x.localeCompare(y)).join('|');
  const prev = prevOf(key);
  if (prev === undefined) return joined({ ...start, key }, l);
  const lead = RANK[l.kind] > RANK[prev.kind] ? { ...prev, ...pick(start) } : prev;
  return joined(lead, l);
}

/** A line as drawn on its own: by kind, the two cards and the interface row it lands on. */
function single(seen: Seen, prevOf: (key: string) => Merged | undefined, l: Link): Merged {
  const row =
    l.row !== null && seen.nodes.get(l.b)?.rows.some((r) => r.id === l.row) === true ? l.row : null;
  const start = startOf(seen, l, row);
  return joined(prevOf(start.key) ?? start, l);
}

/** Lines are drawn between what is on screen: a folded system's parts share its card, so their lines merge. */
export function mergeLinks(
  agg: Aggregate,
  cols: Columns,
  nodes: ReadonlyMap<string, Box>,
): { readonly live: readonly Merged[]; readonly inner: readonly Link[] } {
  const seen = { agg, nodes };
  const merged = new Map<string, Merged>();
  const prevOf = (key: string): Merged | undefined => merged.get(key);
  const shown = agg.links.filter((x) => nodes.has(x.a) && nodes.has(x.b));
  const inner = shown.filter((l) => cols.isInternal(l));
  for (const l of shown.filter((x) => !cols.isInternal(x))) {
    const next = cols.roles.length > 0 ? paired(seen, prevOf, l) : single(seen, prevOf, l);
    merged.set(next.key, next);
  }
  return { live: [...merged.values()], inner };
}
