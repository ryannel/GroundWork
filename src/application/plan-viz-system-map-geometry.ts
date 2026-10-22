import {
  CW,
  G,
  PAD,
  PART_GAP,
  SG,
  SYS_IN,
  VGAP,
  foldedHeight,
  satBox,
  serviceBox,
  systemBox,
  type Box,
  type Context,
} from '@/application/plan-viz-system-map-boxes';
import type { Columns } from '@/application/plan-viz-system-map-columns';

// Where each card sits: down its column, a system's parts inside its frame, topics and stores hanging beneath.

export interface Block {
  readonly top: number;
  readonly bottom: number;
}

/** The band of other domains' cards: where it starts, and the name over each domain's run in a column. */
export interface OutsideBand {
  readonly top: number;
  readonly heads: readonly { readonly x: number; readonly y: number; readonly name: string }[];
}

export interface Placed {
  /** Every card, part, topic and store by id; a part folded into its system maps to the system's box. */
  readonly nodes: ReadonlyMap<string, Box>;
  readonly blocks: readonly (readonly Block[])[];
  readonly w: number;
  readonly h: number;
  readonly top: number;
  /** The room between columns. */
  readonly gap: number;
  readonly outside: OutsideBand | null;
}

interface Walk {
  readonly ctx: Context;
  readonly cols: Columns;
  readonly nodes: ReadonlyMap<string, Box>;
  /** Records where a card, part, topic or store is drawn. */
  readonly put: (id: string, box: Box) => void;
  readonly satsOf: ReadonlyMap<string, readonly string[]>;
  /** Systems the reader has flipped from what the layer toggle says. */
  readonly flip: ReadonlySet<string>;
  readonly expandParts: boolean;
}

export const colX = (c: number, gap: number = G): number => PAD + c * (CW + gap);

function satsByUnit(ctx: Context, cols: Columns): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [sat, host] of ctx.agg.hostOfSat) {
    const shown = ctx.agg.isTopic(sat) ? ctx.show.topics : ctx.show.stores;
    if (!shown) continue;
    const unit = cols.sysOf.get(host) ?? host;
    out.set(unit, [...(out.get(unit) ?? []), sat]);
  }
  const rank = (id: string): number => (ctx.agg.isTopic(id) ? 0 : 1);
  for (const [unit, list] of out) {
    out.set(
      unit,
      list.toSorted((a, b) =>
        rank(a) === rank(b) ? ctx.label(a).localeCompare(ctx.label(b)) : rank(a) - rank(b),
      ),
    );
  }
  return out;
}

interface At {
  readonly x: number;
  readonly y: number;
  readonly col: number;
}

/** A system card: each part inset inside it, or folded to one card. */
function placeSystem(walk: Walk, unit: string, at: At): Box {
  const parts = walk.cols.membersOf(unit);
  const open = systemBox(walk.ctx, unit, { ...at, parts });
  if (walk.expandParts === walk.flip.has(unit)) {
    const listed = { ...open, list: true };
    const frame = { ...listed, h: foldedHeight(listed) };
    for (const id of [unit, ...parts]) walk.put(id, frame);
    return frame;
  }
  let y = at.y + open.head;
  const placedParts: (readonly [string, Box])[] = [];
  for (const id of parts) {
    const part = {
      ...serviceBox(walk.ctx, id, {
        x: at.x + SYS_IN,
        y,
        w: CW - SYS_IN - 8,
        col: at.col,
        part: true,
      }),
      sys: unit,
    };
    placedParts.push([id, part]);
    y += part.h + PART_GAP;
  }
  const frame = { ...open, h: y - PART_GAP + 9 - at.y };
  walk.put(unit, frame);
  for (const [id, box] of placedParts) walk.put(id, box);
  return frame;
}

/** The topics and stores under a card, each a little below the last; returns where the block ends. */
function placeSats(walk: Walk, unit: string, block: Box): number {
  let y = block.y + block.h;
  for (const id of walk.satsOf.get(unit) ?? []) {
    y += SG;
    const sat = satBox(walk.ctx, id, { block, y, unit });
    const host = sat.host === null ? null : (walk.nodes.get(sat.host)?.id ?? sat.host);
    walk.put(id, { ...sat, host });
    y += sat.h;
  }
  return y;
}

function placeUnit(
  walk: Walk,
  unit: string,
  at: At & { readonly prevCompact: boolean },
): { readonly block: Box; readonly bottom: number; readonly compact: boolean } {
  if (walk.cols.partsOf.has(unit)) {
    const block = placeSystem(walk, unit, at);
    return { block, bottom: placeSats(walk, unit, block), compact: false };
  }
  // a service with nothing drawn to or under it is a one-line card, as is an outside party on a tiered map
  const upstream = walk.cols.roles.length > 0 && walk.ctx.nodes.get(unit)?.kind === 'external';
  const bare =
    !walk.cols.linked.has(unit) &&
    !walk.satsOf.has(unit) &&
    !(walk.ctx.show.ifs && walk.ctx.agg.rowsOf.has(unit));
  const compact = upstream || bare;
  const y = compact && at.prevCompact ? at.y - (VGAP - 10) : at.y;
  const block = serviceBox(walk.ctx, unit, { x: at.x, y, w: CW, col: at.col, compact });
  walk.put(unit, block);
  return { block, bottom: placeSats(walk, unit, block), compact };
}

interface Run {
  readonly blocks: readonly Block[];
  readonly end: number;
}

function placeColumn(
  walk: Walk,
  at: { readonly c: number; readonly top: number },
  units: readonly string[],
): Run {
  const blocks: Block[] = [];
  let y = at.top;
  let prevCompact = false;
  for (const unit of units) {
    const placed = placeUnit(walk, unit, {
      x: colX(at.c, walk.cols.gap),
      y,
      col: at.c,
      prevCompact,
    });
    blocks.push({ top: placed.block.y, bottom: placed.bottom });
    prevCompact = placed.compact;
    y = placed.bottom + VGAP;
  }
  return { blocks, end: y - VGAP };
}

const BAND_GAP = 40;
const BAND_HEAD = 30;
const DOMAIN_HEAD = 22;

/** One column's cards from other domains, from the band's top down, each domain's run under its name. */
function placeOutside(
  walk: Walk,
  c: number,
  top: number,
): Run & { readonly heads: OutsideBand['heads'] } {
  const { outside } = walk.cols;
  const units = (walk.cols.cols[c] ?? []).filter((u) => outside.units.has(u));
  const domains = [...new Set(units.map(outside.domainOf))];
  const start = { blocks: [], end: top + BAND_HEAD - VGAP, heads: [] };
  return domains.reduce<Run & { readonly heads: OutsideBand['heads'] }>((acc, name) => {
    const y = acc.end + VGAP;
    const mine = units.filter((u) => outside.domainOf(u) === name);
    const run = placeColumn(walk, { c, top: y + DOMAIN_HEAD }, mine);
    return {
      blocks: [...acc.blocks, ...run.blocks],
      end: run.end,
      heads: [...acc.heads, { x: colX(c, walk.cols.gap), y: y + 12, name }],
    };
  }, start);
}

function placeAll(
  walk: Walk,
  top: number,
): { readonly runs: readonly Run[]; readonly outside: OutsideBand | null } {
  const { cols } = walk;
  const own = cols.cols.map((list, c) =>
    placeColumn(
      walk,
      { c, top },
      list.filter((u) => !cols.outside.units.has(u)),
    ),
  );
  if (cols.outside.units.size === 0) return { runs: own, outside: null };
  const band = Math.max(top, ...own.map((r) => r.end)) + BAND_GAP;
  const others = cols.cols.map((_, c) => placeOutside(walk, c, band));
  const runs = own.map((r, c) => {
    const o = others[c];
    return o === undefined || o.blocks.length === 0
      ? r
      : { blocks: [...r.blocks, ...o.blocks], end: o.end };
  });
  return { runs, outside: { top: band, heads: others.flatMap((o) => o.heads) } };
}

/** `flip`: systems whose parts show the other way round from the Parts toggle. */
export function placeBoxes(ctx: Context, cols: Columns, flip: ReadonlySet<string>): Placed {
  const nodes = new Map<string, Box>();
  const walk: Walk = {
    ctx,
    cols,
    nodes,
    put: (id, box) => {
      nodes.set(id, box);
    },
    satsOf: satsByUnit(ctx, cols),
    flip,
    expandParts: ctx.show.parts,
  };
  const top = ctx.input.stages.length > 0 || cols.roles.length > 0 ? 46 : PAD + 8;
  const { runs: placed, outside } = placeAll(walk, top);
  for (const [id, box] of nodes) {
    if (box.more.length === 0) continue;
    const hidden = box.more.map((r) => ({
      id: r.id,
      label: r.label,
      eps: new Set<string>(),
      n: 0,
      cy: box.moreY,
      hidden: true,
    }));
    nodes.set(id, { ...box, rows: [...box.rows, ...hidden] });
  }
  return {
    nodes,
    blocks: placed.map((p) => p.blocks),
    w: PAD * 2 + cols.cols.length * CW + (cols.cols.length - 1) * cols.gap,
    h: Math.max(top, ...placed.map((p) => p.end)),
    top,
    gap: cols.gap,
    outside,
  };
}
