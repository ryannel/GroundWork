import {
  CW,
  G,
  PAD,
  PART_GAP,
  SG,
  SYS_IN,
  VGAP,
  listedHeight,
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

export interface Placed {
  /** Every card, part, topic and store by id; a part folded into its system maps to the system's box. */
  readonly nodes: Map<string, Box>;
  readonly blocks: readonly (readonly Block[])[];
  readonly w: number;
  readonly h: number;
  readonly top: number;
}

interface Walk {
  readonly ctx: Context;
  readonly cols: Columns;
  readonly nodes: Map<string, Box>;
  readonly satsOf: ReadonlyMap<string, readonly string[]>;
  /** Systems the reader has flipped from what the layer toggle says. */
  readonly flip: ReadonlySet<string>;
  readonly expandParts: boolean;
}

export const colX = (c: number): number => PAD + c * (CW + G);

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

/** A system card: each part inset inside it, or listed on it when folded. */
function placeSystem(walk: Walk, unit: string, at: At): Box {
  const parts = walk.cols.membersOf(unit);
  const frame = systemBox(walk.ctx, unit, { ...at, parts });
  walk.nodes.set(unit, frame);
  if (walk.expandParts === walk.flip.has(unit)) {
    frame.list = true;
    frame.h = listedHeight(frame);
    for (const id of parts) walk.nodes.set(id, frame);
    return frame;
  }
  let y = at.y + frame.head;
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
    walk.nodes.set(id, part);
    y += part.h + PART_GAP;
  }
  frame.h = y - PART_GAP + 9 - at.y;
  return frame;
}

/** The topics and stores under a card, each a little below the last; returns where the block ends. */
function placeSats(walk: Walk, unit: string, block: Box): number {
  let y = block.y + block.h;
  for (const id of walk.satsOf.get(unit) ?? []) {
    y += SG;
    const sat = satBox(walk.ctx, id, { block, y, unit });
    const host = sat.host === null ? null : (walk.nodes.get(sat.host)?.id ?? sat.host);
    walk.nodes.set(id, { ...sat, host });
    y += sat.h;
  }
  return y;
}

function placeUnit(
  walk: Walk,
  unit: string,
  at: At & { readonly prevCompact: boolean },
): { block: Box; bottom: number; compact: boolean } {
  if (walk.cols.partsOf.has(unit)) {
    const block = placeSystem(walk, unit, at);
    return { block, bottom: placeSats(walk, unit, block), compact: false };
  }
  // a service with nothing drawn to or under it is a one-line card
  const compact =
    !walk.cols.linked.has(unit) &&
    !walk.satsOf.has(unit) &&
    !(walk.ctx.show.ifs && walk.ctx.agg.rowsOf.has(unit));
  const y = compact && at.prevCompact ? at.y - (VGAP - 10) : at.y;
  const block = serviceBox(walk.ctx, unit, { x: at.x, y, w: CW, col: at.col, compact });
  walk.nodes.set(unit, block);
  return { block, bottom: placeSats(walk, unit, block), compact };
}

function placeColumn(walk: Walk, c: number, top: number): { blocks: Block[]; end: number } {
  const blocks: Block[] = [];
  let y = top;
  let prevCompact = false;
  for (const unit of walk.cols.cols[c] ?? []) {
    const placed = placeUnit(walk, unit, { x: colX(c), y, col: c, prevCompact });
    blocks.push({ top: placed.block.y, bottom: placed.bottom });
    prevCompact = placed.compact;
    y = placed.bottom + VGAP;
  }
  return { blocks, end: y - VGAP };
}

/** `flip`: systems whose parts show the other way round from the Parts toggle. */
export function placeBoxes(ctx: Context, cols: Columns, flip: ReadonlySet<string>): Placed {
  const nodes = new Map<string, Box>();
  const walk: Walk = {
    ctx,
    cols,
    nodes,
    satsOf: satsByUnit(ctx, cols),
    flip,
    expandParts: ctx.show.parts,
  };
  const top = ctx.input.stages.length > 0 ? 46 : PAD + 8;
  const placed = cols.cols.map((_, c) => placeColumn(walk, c, top));
  for (const box of nodes.values()) {
    for (const r of box.more)
      box.rows.push({
        id: r.id,
        label: r.label,
        eps: new Set(),
        n: 0,
        cy: box.moreY,
        hidden: true,
      });
  }
  return {
    nodes,
    blocks: placed.map((p) => p.blocks),
    w: PAD * 2 + cols.cols.length * CW + (cols.cols.length - 1) * G,
    h: Math.max(top, ...placed.map((p) => p.end)),
    top,
  };
}
