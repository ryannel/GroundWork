import type { Aggregate, Link } from '@/application/plan-viz-system-map-links';
import type { SystemMapInput } from '@/application/plan-viz-system-map-types';

// Which column each card sits in, and in what order down the column.

export interface Columns {
  /** The columns, each a list of units: a service, or a system whose parts share the column. */
  readonly cols: readonly (readonly string[])[];
  /** The stage each column shows, by its place in the plan's stages. */
  readonly used: readonly number[];
  readonly partsOf: ReadonlyMap<string, readonly string[]>;
  readonly sysOf: ReadonlyMap<string, string>;
  readonly unitOf: (id: string) => string;
  readonly isInternal: (link: Link) => boolean;
  readonly colOfU: (unit: string) => number;
  readonly membersOf: (unit: string) => readonly string[];
  /** Units with a line to or from at least one other. */
  readonly linked: ReadonlySet<string>;
}

const hostOf = (agg: Aggregate, id: string): string => agg.hostOfSat.get(id) ?? id;

function neighbours(
  ids: readonly string[],
  pairs: readonly (readonly [string, string])[],
): Map<string, Set<string>> {
  const nb = new Map(ids.map((id) => [id, new Set<string>()]));
  for (const [a, b] of pairs) {
    if (a !== b) {
      nb.get(a)?.add(b);
      nb.get(b)?.add(a);
    }
  }
  return nb;
}

const bothIn = (
  pairs: readonly (readonly [string, string])[],
  known: ReadonlyMap<string, unknown>,
) => pairs.filter(([a, b]) => known.has(a) && known.has(b));

const firstDiff = (...diffs: readonly number[]): number => diffs.find((d) => d !== 0) ?? 0;

function relax(
  rank: ReadonlyMap<string, number>,
  dir: readonly (readonly [string, string])[],
  limit: number,
): ReadonlyMap<string, number> | null {
  const relaxed = new Map(rank);
  let moved = false;
  for (const [a, b] of dir) {
    const next = (relaxed.get(a) ?? 0) + 1;
    if ((relaxed.get(b) ?? 0) < next && next < limit) {
      relaxed.set(b, next);
      moved = true;
    }
  }
  return moved ? relaxed : null;
}

/** With no stages, the longest chain of calls and events puts each card one step after what feeds it. */
function ranks(
  ids: readonly string[],
  pairs: readonly (readonly [string, string])[],
): ReadonlyMap<string, number> {
  const start: ReadonlyMap<string, number> = new Map(ids.map((id) => [id, 0]));
  const dir = bothIn(pairs, start).filter(([a, b]) => a !== b);
  const settle = (rank: ReadonlyMap<string, number>, left: number): ReadonlyMap<string, number> => {
    const next = left === 0 ? null : relax(rank, dir, ids.length);
    return next === null ? rank : settle(next, left - 1);
  };
  return settle(start, ids.length);
}

function stageColumns(input: SystemMapInput, agg: Aggregate): ReadonlyMap<string, number> {
  const ids = input.services.map((s) => s.id);
  if (input.stages.length === 0) {
    const dir = agg.links
      .filter((l) => l.kind !== 'data')
      .map((l): [string, string] => [hostOf(agg, l.a), hostOf(agg, l.b)]);
    return ranks(ids, dir);
  }
  const entries = ids.map((id): [string, number | undefined] => [id, input.stageOf[id]]);
  return new Map(entries.filter((e): e is [string, number] => e[1] !== undefined));
}

/** A card no stage owns joins its nearest neighbour's column, else the first. */
function fillGaps(
  col: ReadonlyMap<string, number>,
  ids: readonly string[],
  nb: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlyMap<string, number> {
  const filled = new Map(col);
  for (let pass = 0; pass < 2; pass += 1) {
    for (const id of ids.filter((x) => !filled.has(x))) {
      const near = [...(nb.get(id) ?? [])].map((n) => filled.get(n)).filter((c) => c !== undefined);
      if (near.length > 0 || pass === 1) filled.set(id, near.length > 0 ? Math.min(...near) : 0);
    }
  }
  return filled;
}

function assign(input: SystemMapInput, agg: Aggregate): ReadonlyMap<string, number> {
  const ids = input.services.map((s) => s.id);
  const col = stageColumns(input, agg);
  const pairs = agg.links.map((l): [string, string] => [hostOf(agg, l.a), hostOf(agg, l.b)]);
  return fillGaps(col, ids, neighbours(ids, bothIn(pairs, new Map(ids.map((id) => [id, 0])))));
}

/** The deployables of one system are one unit when they share a column. */
function systemParts(
  input: SystemMapInput,
  col: ReadonlyMap<string, number>,
): Map<string, string[]> {
  const known = new Set(input.systems.map((s) => s.id));
  const parts = new Map<string, string[]>();
  for (const svc of input.services) {
    if (svc.system === null || !known.has(svc.system)) continue;
    parts.set(svc.system, [...(parts.get(svc.system) ?? []), svc.id]);
  }
  for (const [sys, ids] of parts) {
    if (new Set(ids.map((id) => col.get(id))).size !== 1) parts.delete(sys);
  }
  return parts;
}

interface Place {
  readonly cols: readonly (readonly string[])[];
  readonly nbU: ReadonlyMap<string, ReadonlySet<string>>;
  readonly colOfU: (unit: string) => number;
}

/** Authored stage order, then the order the plan lists them in. */
function startOrder(
  input: SystemMapInput,
  members: (u: string) => readonly string[],
): (a: string, b: string) => number {
  const authored = new Map<string, number>();
  for (const stage of input.stages) {
    for (const [i, x] of stage.entries.entries()) {
      if (!authored.has(x.svc)) authored.set(x.svc, i);
    }
  }
  const listed = new Map(input.services.map((s, i) => [s.id, i]));
  const first = (u: string, map: ReadonlyMap<string, number>, otherwise: number): number =>
    Math.min(...members(u).map((id) => map.get(id) ?? otherwise));
  return (a, b) =>
    firstDiff(
      first(a, authored, 999) - first(b, authored, 999),
      first(a, listed, 0) - first(b, listed, 0),
    );
}

function pullToward(place: Place, c: number): string[] {
  const { cols, nbU, colOfU } = place;
  const pos = new Map<string, number>();
  for (const list of cols) for (const [i, u] of list.entries()) pos.set(u, (i + 0.5) / list.length);
  const here = cols[c] ?? [];
  const items = here.map((u, i) => {
    const near = [...(nbU.get(u) ?? [])].filter((n) => colOfU(n) !== c);
    const mean = near.reduce((t, n) => t + (pos.get(n) ?? 0), 0) / Math.max(near.length, 1);
    const own = (i + 0.5) / here.length;
    return {
      u,
      s: near.length > 0 ? mean : own,
      i: own,
      iso: (nbU.get(u)?.size ?? 0) === 0 ? 1 : 0,
    };
  });
  return items.toSorted((x, y) => firstDiff(x.iso - y.iso, x.s - y.s, x.i - y.i)).map((x) => x.u);
}

/** Providers above their users (callee above caller, publisher above consumer) so lines run downhill. */
function providersFirst(
  list: readonly string[],
  above: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  const out: string[] = [];
  const left = [...list];
  while (left.length > 0) {
    const found = left.findIndex((u) =>
      [...(above.get(u) ?? [])].every((p) => out.includes(p) || !list.includes(p)),
    );
    const [next] = left.splice(Math.max(found, 0), 1);
    if (next !== undefined) out.push(next);
  }
  return out;
}

function aboveOf(
  agg: Aggregate,
  own: Pick<Columns, 'unitOf' | 'isInternal' | 'colOfU'>,
): Map<string, Set<string>> {
  const above = new Map<string, Set<string>>();
  for (const l of agg.links) {
    const a = own.unitOf(l.a);
    const b = own.unitOf(l.b);
    if (own.isInternal(l) || a === b || own.colOfU(a) !== own.colOfU(b)) continue;
    const [provider, user] = l.kind === 'msg' ? [a, b] : [b, a];
    above.set(user, (above.get(user) ?? new Set()).add(provider));
  }
  return above;
}

function orderColumns(
  input: SystemMapInput,
  place: Place,
  members: (u: string) => readonly string[],
): readonly (readonly string[])[] {
  const byStart = startOrder(input, members);
  const cols = place.cols.map((list) => list.toSorted(byStart));
  const order = cols.map((_, c) => c);
  for (let it = 0; it < 6; it += 1) {
    for (const c of it % 2 === 1 ? order.toReversed() : order) {
      cols[c] = pullToward({ ...place, cols }, c);
    }
  }
  return cols;
}

export function layoutColumns(input: SystemMapInput, agg: Aggregate): Columns {
  const col = assign(input, agg);
  const partsOf = systemParts(input, col);
  const sysOf = new Map(
    [...partsOf].flatMap(([sys, ids]) => ids.map((id): [string, string] => [id, sys])),
  );
  const unitOf = (id: string): string => sysOf.get(hostOf(agg, id)) ?? hostOf(agg, id);
  const membersOf = (u: string): readonly string[] => partsOf.get(u) ?? [u];
  const isInternal = (l: Link): boolean => unitOf(l.a) === unitOf(l.b) && partsOf.has(unitOf(l.a));
  const units = [...new Set(input.services.map((s) => sysOf.get(s.id) ?? s.id))];
  const used = [...new Set(col.values())].toSorted((a, b) => a - b);
  const colIdx = new Map(used.map((c, i) => [c, i]));
  const colOfU = (u: string): number => colIdx.get(col.get(membersOf(u)[0] ?? u) ?? 0) ?? 0;
  const pairs = agg.links
    .filter((l) => !isInternal(l))
    .map((l): [string, string] => [unitOf(l.a), unitOf(l.b)]);
  const nbU = neighbours(units, bothIn(pairs, new Map(units.map((u) => [u, 0]))));
  const cols: string[][] = used.map(() => []);
  for (const u of units) cols[colOfU(u)]?.push(u);
  const sorted = orderColumns(input, { cols, nbU, colOfU }, membersOf).map((list) =>
    providersFirst(list, aboveOf(agg, { unitOf, isInternal, colOfU })),
  );
  const linked = new Set(units.filter((u) => (nbU.get(u)?.size ?? 0) > 0));
  return { cols: sorted, used, partsOf, sysOf, unitOf, isInternal, colOfU, membersOf, linked };
}
