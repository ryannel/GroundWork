// A domain's target drawn as a flow: one card for each stage, holding the systems that should own it, and a line
// from each stage to every stage it feeds. Lanes sit one above the other on the left, and meet in a trunk that runs
// straight to the right (see workspace-target-flow-grid.ts for where each stage sits).

import { wrapTitle } from '@/application/plan-viz-dag-text';
import type { ChipRef } from '@/application/today-scope';

import { type Grid, gridOf, TRUNK } from './workspace-target-flow-grid';

export const CARD_W = 200;
const COL_GAP = 64;
const ROW_GAP = 16;
const LANE_GAP = 36;
const PAD = 8;
const TITLE_LINE = 20;
const HEAD = 20;
const BADGE = 20;
const LINE = 18;
const PLACE = 16;
const OWNER_GAP = 4;
const FOOT = 12;
const TITLE_CHARS = 20;
const OWNER_CHARS = 21;
const SPREAD = 12;

export interface FlowStageIn {
  readonly id: string;
  readonly name: string;
  readonly from: readonly string[];
  readonly owners: readonly (ChipRef & { readonly place: string | null })[];
}

export interface FlowOwner {
  readonly chip: ChipRef;
  /** Its name, wrapped to fit the card. */
  readonly lines: readonly string[];
  /** Where it lives when that is not this domain ("Lives in Shopping"), unless the card already says so. */
  readonly place: string | null;
}

export interface FlowCard {
  readonly id: string;
  readonly title: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly h: number;
  readonly owners: readonly FlowOwner[];
  /** Where every owner lives, when none of them is in this domain. */
  readonly outside: string | null;
  /** Where lanes meet. */
  readonly hub: boolean;
  /** The stages it is made from, and the stages it feeds: what lights up with it. */
  readonly near: readonly string[];
}

export interface FlowLine {
  readonly from: string;
  readonly to: string;
  readonly d: string;
}

export interface TargetFlow {
  readonly w: number;
  readonly h: number;
  readonly cards: readonly FlowCard[];
  readonly lines: readonly FlowLine[];
}

interface Box {
  readonly stage: FlowStageIn;
  readonly order: number;
  readonly col: number;
  readonly lane: number;
  readonly h: number;
}

/** Where each card's top sits, filled in lane by lane and then along the trunk. */
type Tops = ReadonlyMap<Box, number>;

const topOf = (tops: Tops, box: Box) => tops.get(box) ?? 0;
const centreIn = (tops: Tops) => (box: Box) => topOf(tops, box) + box.h / 2;
const byNumber = (a: number, b: number) => a - b;
const mean = (values: readonly number[]) =>
  values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;

function outsideOf(stage: FlowStageIn): string | null {
  const places = new Set(stage.owners.map((owner) => owner.place));
  const [only] = places;
  return places.size === 1 && only !== undefined ? only : null;
}

function ownerRow(owner: { readonly lines: readonly string[]; readonly place: string | null }) {
  return owner.lines.length * LINE + (owner.place === null ? 0 : PLACE) + OWNER_GAP;
}

function cardText(stage: FlowStageIn) {
  const outside = outsideOf(stage);
  const owners = stage.owners.map(({ place, ...chip }) => ({
    chip,
    lines: wrapTitle(chip.label, OWNER_CHARS, 2),
    place: outside === null ? place : null,
  }));
  const title = wrapTitle(stage.name, TITLE_CHARS, 2);
  const badge = outside === null ? 0 : BADGE;
  const rows = owners.reduce((sum, owner) => sum + ownerRow(owner), 0);
  return { title, owners, outside, h: HEAD + title.length * TITLE_LINE + badge + rows + FOOT };
}

type Entries = readonly (readonly [Box, number])[];

/** Puts boxes of one column in order, as near where they want to be as the ones above them allow. */
function settle(
  column: readonly Box[],
  at: { readonly want: (box: Box) => number; readonly top: number },
): Entries {
  const sorted = column.toSorted((a, b) => {
    const by = at.want(a) - at.want(b);
    return by === 0 ? a.order - b.order : by;
  });
  const entries: [Box, number][] = [];
  let floor = at.top;
  for (const box of sorted) {
    const y = Math.max(at.want(box) - box.h / 2, floor);
    entries.push([box, y]);
    floor = y + box.h + ROW_GAP;
  }
  return entries;
}

function byColumn(boxes: readonly Box[]): readonly (readonly Box[])[] {
  const cols = [...new Set(boxes.map((box) => box.col))].toSorted(byNumber);
  return cols.map((col) => boxes.filter((box) => box.col === col));
}

const stackOf = (column: readonly Box[]) =>
  column.reduce((sum, box) => sum + box.h, 0) + ROW_GAP * (column.length - 1);

/** Moves a column up when settling pushed it past the bottom of its lane, as far as its top allows. */
function lift(column: Entries, lane: { readonly top: number; readonly height: number }): Entries {
  const first = Math.min(...column.map(([, y]) => y));
  const last = Math.max(...column.map(([box, y]) => y + box.h));
  const up = Math.max(0, Math.min(last - lane.top - lane.height, first - lane.top));
  return column.map(([box, y]) => [box, y - up]);
}

/** One lane from `top`: each stage level with what it is made from, then each lone source level with what it feeds. */
function placeLane(
  placed: Tops,
  members: readonly Box[],
  at: { readonly top: number; readonly grid: Grid },
): { readonly tops: Tops; readonly bottom: number } {
  const { top, grid } = at;
  const tops = new Map(placed);
  const ids = new Map(members.map((box) => [box.stage.id, box]));
  const columns = byColumn(members);
  const height = Math.max(...columns.map(stackOf));
  const linked = (ofs: readonly string[]) =>
    mean(ofs.flatMap((id) => ids.get(id) ?? []).map(centreIn(tops))) ?? top + height / 2;
  for (const column of columns) {
    const settled = settle(column, { want: (box) => linked(box.stage.from), top });
    for (const [box, y] of lift(settled, { top, height })) {
      tops.set(box, y);
    }
  }
  for (const column of columns) {
    const [lone] = column;
    if (column.length !== 1 || lone === undefined || lone.stage.from.some((id) => ids.has(id))) {
      continue;
    }
    const want = linked(grid.feeds.get(lone.stage.id) ?? []) - lone.h / 2;
    tops.set(lone, Math.min(Math.max(want, top), top + height - lone.h));
  }
  return { tops, bottom: top + height };
}

/** The nearest place in a column to `want` that no placed box takes. */
function freeSlot(tops: Tops, box: Box, taken: readonly Box[]) {
  return (want: number): number => {
    const clear = (y: number) =>
      !taken.some(
        (t) => y < topOf(tops, t) + t.h + ROW_GAP && topOf(tops, t) < y + box.h + ROW_GAP,
      );
    const tries = [
      want,
      ...taken.flatMap((t) => [topOf(tops, t) + t.h + ROW_GAP, topOf(tops, t) - ROW_GAP - box.h]),
    ];
    const free = tries.filter(clear).toSorted((a, b) => Math.abs(a - want) - Math.abs(b - want));
    return free[0] ?? want;
  };
}

/** The trunk, left to right: each stage level with the trunk before it, or with all it is made from. */
function placeTrunk(placed: Tops, trunk: readonly Box[], mid: number): Tops {
  const tops = new Map(placed);
  const byId = new Map([...tops.keys()].map((box) => [box.stage.id, box]));
  const order = trunk.toSorted((a, b) => (a.col === b.col ? a.order - b.order : a.col - b.col));
  for (const box of order) {
    const from = box.stage.from.flatMap((id) => byId.get(id) ?? []);
    const along = from.filter((b) => b.lane === TRUNK);
    const want = (mean((along.length > 0 ? along : from).map(centreIn(tops))) ?? mid) - box.h / 2;
    const taken = [...tops.keys()].filter((b) => b.col === box.col);
    tops.set(box, freeSlot(tops, box, taken)(want));
    byId.set(box.stage.id, box);
  }
  return tops;
}

const xOf = (col: number) => PAD + col * (CARD_W + COL_GAP);

/** Where each line leaves and joins a card: spread down its edge in the order of the other ends. */
function port(tops: Tops, box: Box, others: readonly Box[]) {
  const centre = centreIn(tops);
  const sorted = others.toSorted((a, b) => {
    const by = centre(a) - centre(b);
    return by === 0 ? a.order - b.order : by;
  });
  const n = sorted.length;
  const step = Math.min(SPREAD, (box.h - 2 * FOOT) / Math.max(n - 1, 1));
  return (other: Box): number => centre(box) + (sorted.indexOf(other) - (n - 1) / 2) * step;
}

type Point = readonly [number, number];
const at = (p: Point) => `${String(p[0])},${String(p[1])}`;
const bendTo = (a: Point, b: Point, bend: number) =>
  `C${at([a[0] + bend, a[1]])} ${at([b[0] - bend, b[1]])} ${at(b)}`;

/** A height that runs clear of every card in the columns a line skips, as near its two ends as it can be. */
function corridor(tops: Tops, skipped: readonly Box[], ends: Point): number {
  const half = ROW_GAP / 2;
  const clear = (y: number) =>
    !skipped.some((b) => y > topOf(tops, b) - half && y < topOf(tops, b) + b.h + half);
  const tries = [
    ...ends,
    ...skipped.flatMap((b) => [topOf(tops, b) - half, topOf(tops, b) + b.h + half]),
  ];
  const cost = (y: number) => Math.abs(y - ends[0]) + Math.abs(y - ends[1]);
  return tries.filter(clear).toSorted((a, b) => cost(a) - cost(b))[0] ?? ends[0];
}

/** A line from one card to a later one; past the next column it runs level through a gap between the cards. */
function route(tops: Tops, ends: { readonly from: Box; readonly to: Box }, ys: Point): string {
  const { from, to } = ends;
  const start: Point = [xOf(from.col) + CARD_W, ys[0]];
  const end: Point = [xOf(to.col), ys[1]];
  const bend = COL_GAP / 2;
  if (to.col === from.col + 1) return `M${at(start)} ${bendTo(start, end, bend)}`;
  const skipped = [...tops.keys()].filter((b) => b.col > from.col && b.col < to.col);
  const y = corridor(tops, skipped, ys);
  const enter: Point = [xOf(from.col + 1), y];
  const leave: Point = [xOf(to.col - 1) + CARD_W, y];
  return `M${at(start)} ${bendTo(start, enter, bend)} L${at(leave)} ${bendTo(leave, end, bend)}`;
}

/** A line for each stage a stage is made from; a line that would run backwards, in a loop, is left out. */
function linesOf(tops: Tops, boxes: readonly Box[], grid: Grid): FlowLine[] {
  const byId = new Map(boxes.map((box) => [box.stage.id, box]));
  const get = (ids: readonly string[]) => ids.flatMap((id) => byId.get(id) ?? []);
  return boxes.flatMap((to) =>
    get(to.stage.from)
      .filter((from) => from.col < to.col)
      .map((from) => {
        const y1 = port(tops, from, get(grid.feeds.get(from.stage.id) ?? []))(to);
        const y2 = port(tops, to, get(to.stage.from))(from);
        return { from: from.stage.id, to: to.stage.id, d: route(tops, { from, to }, [y1, y2]) };
      }),
  );
}

/** The flow of a target's stages, laid out and ready to draw. */
export function targetFlowOf(stages: readonly FlowStageIn[]): TargetFlow {
  const grid = gridOf(stages);
  const texts = new Map(stages.map((stage) => [stage.id, cardText(stage)]));
  const boxes: readonly Box[] = stages.map((stage, order) => ({
    stage,
    order,
    col: grid.col.get(stage.id) ?? 0,
    lane: grid.lane.get(stage.id) ?? TRUNK,
    h: texts.get(stage.id)?.h ?? 0,
  }));
  let tops: Tops = new Map();
  const laneIds = [...new Set(boxes.map((box) => box.lane))]
    .filter((l) => l !== TRUNK)
    .toSorted(byNumber);
  let top = PAD;
  for (const lane of laneIds) {
    const members = boxes.filter((box) => box.lane === lane);
    const placed = placeLane(tops, members, { top, grid });
    tops = placed.tops;
    top = placed.bottom + LANE_GAP;
  }
  tops = placeTrunk(
    tops,
    boxes.filter((box) => box.lane === TRUNK),
    (PAD + top - LANE_GAP) / 2,
  );
  return drawn(tops, boxes, { grid, texts });
}

function drawn(
  placed: Tops,
  boxes: readonly Box[],
  with_: { readonly grid: Grid; readonly texts: ReadonlyMap<string, ReturnType<typeof cardText>> },
): TargetFlow {
  const { grid, texts } = with_;
  const shift = PAD - Math.min(PAD, ...boxes.map((box) => topOf(placed, box)));
  const tops: Tops = new Map(boxes.map((box) => [box, topOf(placed, box) + shift]));
  const reading = boxes.toSorted((a, b) =>
    a.col === b.col ? topOf(tops, a) - topOf(tops, b) : a.col - b.col,
  );
  const cards = reading.map((box): FlowCard => {
    const text = texts.get(box.stage.id) ?? cardText(box.stage);
    const near = [...box.stage.from, ...(grid.feeds.get(box.stage.id) ?? [])];
    const id = box.stage.id;
    return { id, x: xOf(box.col), y: topOf(tops, box), ...text, hub: grid.hubs.has(id), near };
  });
  return {
    w: xOf(Math.max(0, ...boxes.map((box) => box.col))) + CARD_W + PAD,
    h: Math.max(0, ...boxes.map((box) => topOf(tops, box) + box.h)) + PAD,
    cards,
    lines: linesOf(tops, boxes, grid),
  };
}
