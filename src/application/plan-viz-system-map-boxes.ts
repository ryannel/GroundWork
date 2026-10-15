import { shortTopic, wrapText } from '@/application/plan-viz-flow-geometry';
import type { Aggregate, RowCount } from '@/application/plan-viz-system-map-links';
import type {
  MapNodeIn,
  MapSatelliteIn,
  MapShow,
  SystemMapInput,
} from '@/application/plan-viz-system-map-types';

// The size of each card, system frame, topic and store, and where its text sits.

export const CW = 184;
export const G = 56;
export const PAD = 16;
export const VGAP = 24;
export const LINE = 15;
const ROW = 20;
export const SG = 6;
const SIN = 14;
export const SAT_LINE = 13;
export const SYS_IN = 16;
export const PART_GAP = 8;
const HEAD = 46;
const MAXROWS = 4;
const SH = 24;
const SH2 = 36;
const NAME_CH = 21;
const ROLE_CH = 26;
export const ROLE_LINE = 14;
export const SYS_NAME = 38;
export const PART_ROW = 17;
const MONO = 6.3;
const SAT_CH = {
  topic: Math.floor((CW - SIN - 34) / MONO),
  store: Math.floor((CW - SIN - 20) / MONO),
};
const SAT_ROLE_CH = { topic: 24, store: 27 };

export interface Row extends RowCount {
  readonly label: string;
  cy: number;
  hidden: boolean;
}

export interface Box {
  readonly id: string;
  readonly kind: 'service' | 'system' | 'topic' | 'store';
  x: number;
  y: number;
  w: number;
  h: number;
  readonly col: number;
  readonly head: number;
  readonly lines: readonly string[];
  readonly role: readonly string[];
  readonly nameEnd: number;
  readonly compact: boolean;
  readonly part: boolean;
  /** The text inset on a card. */
  readonly tx: number;
  readonly rows: Row[];
  readonly more: readonly { readonly id: string; readonly label: string }[];
  moreY: number;
  readonly top: number;
  /** The card a topic or store hangs under, and the unit whose trunk it hangs from. */
  readonly host: string | null;
  readonly trunk: string | null;
  readonly sys: string | null;
  readonly parts: readonly string[];
  list: boolean;
}

export interface Context {
  readonly input: SystemMapInput;
  readonly agg: Aggregate;
  readonly show: MapShow;
  readonly nodes: ReadonlyMap<string, MapNodeIn | MapSatelliteIn>;
  readonly label: (id: string) => string;
}

const BLANK: Omit<Box, 'id' | 'kind' | 'x' | 'y' | 'w' | 'h' | 'col'> = {
  head: 0,
  lines: [],
  role: [],
  nameEnd: 0,
  compact: false,
  part: false,
  tx: 20,
  rows: [],
  more: [],
  moreY: 0,
  top: 0,
  host: null,
  trunk: null,
  sys: null,
  parts: [],
  list: false,
};

/** A satellite's name in at most two lines: env prefix dropped, then leading dotted segments (the owner is the card above). */
function satLines(name: string, max: number): string[] {
  let s = shortTopic(name);
  if (s.length > max && s.includes('.') && !/\s/.test(s)) {
    const parts = s.split('.');
    while (parts.length > 1 && parts.join('.').length > max) parts.shift();
    s = parts.join('.');
  }
  return s.length <= max ? [s] : wrapText(s, max, 2);
}

function rowsFor(ctx: Context, id: string): Row[] {
  if (!ctx.show.ifs) return [];
  const rows = [...(ctx.agg.rowsOf.get(id)?.values() ?? [])].map((r) => ({
    ...r,
    label: ctx.label(r.id),
    cy: 0,
    hidden: false,
  }));
  return rows.toSorted((a, b) => (a.n === b.n ? a.label.localeCompare(b.label) : b.n - a.n));
}

interface CardAt {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly col: number;
  readonly part?: boolean;
  readonly compact?: boolean;
}

const roleLines = (text: string, room: number, max: number): string[] =>
  text === '' ? [] : wrapText(text, room, max);

/** A card with an icon beside its role has less room for the words. */
const roleRoom = (kind: string, part: boolean): number =>
  (part ? ROLE_CH - 2 : ROLE_CH) - (kind !== '' && kind !== 'service' ? 3 : 0);

function headOf(
  ctx: Context,
  id: string,
  look: { readonly part: boolean; readonly compact: boolean },
) {
  const { part, compact } = look;
  const node = ctx.nodes.get(id);
  const lines = wrapText(ctx.label(id), part ? NAME_CH - 2 : NAME_CH, 2);
  const role = roleLines(node?.does ?? '', roleRoom(node?.kind ?? '', part), part ? 3 : 2);
  const nameEnd = 20 + (lines.length - 1) * LINE;
  const plain = (compact ? 32 : HEAD) + (compact ? 0 : (lines.length - 1) * LINE);
  return {
    lines,
    role,
    nameEnd,
    head: role.length > 0 ? nameEnd + 2 + role.length * ROLE_LINE + 9 : plain,
  };
}

/** Up to MAXROWS interface rows; more than that folds the last into "+n more interfaces". */
function placeRows(ctx: Context, id: string, top: number): Pick<Box, 'rows' | 'more' | 'moreY'> {
  const all = rowsFor(ctx, id);
  const rows = all.length > MAXROWS ? all.slice(0, MAXROWS - 1) : all;
  for (const [k, r] of rows.entries()) {
    r.cy = top + k * ROW + ROW / 2;
  }
  const more = all.slice(rows.length).map((r) => ({ id: r.id, label: r.label }));
  return { rows, more, moreY: top + rows.length * ROW + ROW / 2 };
}

export function serviceBox(ctx: Context, id: string, at: CardAt): Box {
  const { part = false, compact = false, x, y, w, col } = at;
  const head = headOf(ctx, id, { part, compact });
  const placed = placeRows(ctx, id, y + head.head);
  const count = placed.rows.length + (placed.more.length > 0 ? 1 : 0);
  return {
    ...BLANK,
    ...head,
    ...placed,
    id,
    kind: 'service',
    x,
    y,
    w,
    h: head.head + (count > 0 ? count * ROW + 6 : 0),
    col,
    compact,
    part,
    tx: part ? 12 : 20,
  };
}

/** A system's frame: eyebrow, name and role; the height is set once the parts are placed or listed. */
export function systemBox(
  ctx: Context,
  id: string,
  at: Pick<CardAt, 'x' | 'y' | 'col'> & { readonly parts: readonly string[] },
): Box {
  const lines = wrapText(ctx.label(id), NAME_CH, 2);
  const role = roleLines(ctx.nodes.get(id)?.does ?? '', ROLE_CH, 3);
  const nameEnd = SYS_NAME + (lines.length - 1) * LINE;
  const head = nameEnd + (role.length > 0 ? 2 + role.length * ROLE_LINE : 0) + 12;
  return { ...BLANK, ...at, id, kind: 'system', w: CW, h: head, head, lines, role, nameEnd };
}

/** A frame folded to one card lists its parts. */
export function listedHeight(frame: Box): number {
  return frame.head + frame.parts.length * PART_ROW + 4;
}

function satText(ctx: Context, id: string): Pick<Box, 'lines' | 'role' | 'top' | 'h'> {
  const node = ctx.nodes.get(id);
  const topic = ctx.agg.isTopic(id);
  const k = topic ? 'topic' : 'store';
  const lines = satLines(ctx.label(id), SAT_CH[k]);
  const carries = topic && node !== undefined && 'carries' in node ? node.carries : [];
  const role = roleLines(
    carries.length > 0 ? carries.join(', ') : (node?.does ?? ''),
    SAT_ROLE_CH[k],
    2,
  );
  const top = topic ? 12 : 14;
  const plain = lines.length > 1 ? SH2 : SH;
  const text = top + (lines.length + role.length - 1) * SAT_LINE + 11;
  return { lines, role, top, h: role.length > 0 ? text : plain };
}

export function satBox(
  ctx: Context,
  id: string,
  at: { readonly block: Box; readonly y: number; readonly unit: string },
): Box {
  return {
    ...BLANK,
    ...satText(ctx, id),
    id,
    kind: ctx.agg.isTopic(id) ? 'topic' : 'store',
    x: at.block.x + SIN,
    y: at.y,
    w: CW - SIN,
    col: at.block.col,
    host: ctx.agg.hostOfSat.get(id) ?? null,
    trunk: at.unit,
  };
}
