import type { Model } from '@/application/plan/derive';
import type { ElementStatus } from '@/application/plan/derive-core';
import { sequenceModel } from '@/application/plan/flow-sequence';
import type { FlowMode } from '@/application/plan/flow-steps';
import { prop } from '@/application/plan/ids';
import { chipInfo } from '@/application/plan-chips';
import { nodeType } from '@/application/plan-viz-map';
import { type Ctx, type SeqCell, type SeqGut, cellOf } from '@/application/plan-viz-sequence-cells';
import { type Item, cellsOf, entriesOf, treeOf } from '@/application/plan-viz-sequence-rows';
import { MAX_COLS, columnTier, isDense, levelName } from '@/application/plan-viz-sequence-text';
import { teamIndex, teamName, teamOf } from '@/application/plan-viz-teams';

// A flow as a sequence drawing: participants as columns, one row per step, time running down.

const MAX_LANES = 5;

export interface SeqPart {
  readonly id: string;
  readonly col: number;
  readonly name: string;
  readonly glyph: string;
  readonly word: string;
  readonly store: boolean;
  readonly status: ElementStatus;
  readonly team: { readonly id: string; readonly slot: number } | null;
  readonly tip: string;
}

export interface SeqKey {
  readonly n: number;
  readonly test: string;
  readonly level: string;
  readonly label: string;
  readonly title: string;
}

export interface SeqView {
  readonly flowId: string;
  readonly title: string;
  readonly mode: FlowMode;
  /** Columns on the lane strip, the person's included. */
  readonly cols: number;
  readonly dense: boolean;
  /** The pixel width every column is at least, one of the tiers. */
  readonly tier: number;
  readonly person: string | null;
  readonly parts: readonly SeqPart[];
  /** Lanes of test brackets in the left gutter. */
  readonly lanes: number;
  readonly items: readonly Item<SeqCell>[];
  readonly key: readonly SeqKey[];
}

export interface SeqViewOptions {
  readonly mode?: FlowMode;
  /** The current step (by index), or steps: rows before the first are drawn as walked. */
  readonly step?: number | readonly number[] | undefined;
  /** Draw the tests that walk the flow as brackets in the left gutter. */
  readonly spans?: boolean;
  /** A mark after a step's action text, by step id. */
  readonly markers?: Readonly<Record<string, string>>;
  readonly markerTitle?: string;
}

const isStore = (model: Model, id: string): boolean =>
  prop(model.get(id), '$type') === 'store' || id.startsWith('st:');

function partOf(model: Model, mode: FlowMode, at: { id: string; col: number }): SeqPart {
  const { id, col } = at;
  const [glyph, word] = nodeType(id, model.get(id));
  const team = teamOf(model, id);
  const name = chipInfo(model, id).label;
  const by = team === null ? '' : ` · ${teamName(model, team)}`;
  const tip = `${word.toLowerCase()}: ${name}${by}`;
  return {
    id,
    col,
    name,
    glyph,
    word,
    store: isStore(model, id),
    status: mode === 'asIs' ? 'existing' : (model.status(id) ?? 'existing'),
    team: team === null ? null : { id: team, slot: teamIndex(model, team) },
    tip,
  };
}

interface Bracket {
  readonly n: number;
  readonly test: string;
  readonly level: string;
  readonly whole: boolean;
  readonly a: number;
  readonly b: number;
  readonly lane: number;
}

/** The tests' brackets over the cell rows they cover, each in the first lane that is free there. */
function bracketsOf(
  model: Model,
  flow: { id: string; mode: FlowMode },
  rowOf: ReadonlyMap<string, number>,
): Bracket[] {
  const ends: number[] = [];
  const out: Omit<Bracket, 'n'>[] = [];
  for (const sp of model.spans(flow.id, flow.mode === 'asIs' ? 'asIs' : 'toBe')) {
    const a = rowOf.get(sp.from ?? '');
    const b = rowOf.get(sp.to ?? '');
    if (a === undefined || b === undefined) continue;
    const free = ends.findIndex((end) => end < a);
    const lane = free === -1 ? ends.length : free;
    if (lane >= MAX_LANES) continue;
    ends[lane] = b;
    out.push({ test: sp.test, level: sp.level, whole: sp.whole, a, b, lane });
  }
  return out.map((x, k) => ({ ...x, n: k + 1 }));
}

function posOf(br: Bracket, k: number): SeqGut['pos'] {
  if (br.a === br.b) return 'only';
  if (k === br.a) return 'first';
  return k === br.b ? 'last' : 'mid';
}

function markOf(model: Model, br: Bracket, k: number): SeqGut {
  const name = chipInfo(model, br.test).label;
  const pos = posOf(br, k);
  return {
    n: br.n,
    test: br.test,
    level: br.level,
    lane: br.lane,
    pos,
    label: name,
    title: `${levelName(br.level)} test: ${name}${br.whole ? ' (walks the whole flow)' : ''}`,
  };
}

const rowsOfSteps = (cells: ReturnType<typeof cellsOf>): Map<string, number> =>
  new Map(cells.flatMap((d, k) => (d.type === 'step' ? [[d.row.step.id, k] as const] : [])));

/** Whether a step in these items is the current one. */
export function holdsCurrent(items: readonly Item<SeqCell>[]): boolean {
  return items.some((it) =>
    it.kind === 'frame' ? holdsCurrent(it.items) : it.kind === 'step' && it.walk === 'current',
  );
}

interface Shape {
  readonly mode: FlowMode;
  readonly parts: readonly string[];
  readonly person: boolean;
  readonly pills: boolean;
}

const stepSet = (step: SeqViewOptions['step']): Set<number> => {
  if (step === undefined) return new Set();
  return new Set(typeof step === 'number' ? [step] : step);
};

function ctxOf(model: Model, opts: SeqViewOptions, shape: Shape): Ctx {
  const cur = stepSet(opts.step);
  const off = shape.person ? 1 : 0;
  return {
    model,
    mode: shape.mode,
    cur,
    curMin: cur.size > 0 ? Math.min(...cur) : Number.POSITIVE_INFINITY,
    off,
    cols: Math.min(shape.parts.length + off, MAX_COLS),
    participants: shape.parts,
    markers: opts.markers ?? {},
    markerTitle: opts.markerTitle ?? 'Planned changes. Click to add it to Changes ahead.',
    pills: shape.pills,
  };
}

function keyOf(model: Model, b: Bracket): SeqKey {
  return {
    n: b.n,
    test: b.test,
    level: b.level,
    label: chipInfo(model, b.test).label,
    title: `${levelName(b.level)} test${b.whole ? ', walks the whole flow' : ''}`,
  };
}

/** The sequence drawing of a flow, or null when it has no steps. */
export function sequenceView(
  model: Model,
  flowId: string,
  opts: SeqViewOptions = {},
): SeqView | null {
  const mode = opts.mode ?? 'toBe';
  const sm = sequenceModel(model, flowId, mode);
  if (sm.steps.length === 0) return null;
  const pills = mode !== 'asIs' && model.status(flowId) !== 'added';
  const ctx = ctxOf(model, opts, { mode, parts: sm.parts, person: sm.actor !== null, pills });
  const entries = entriesOf(sm.rows);
  const rowOf = rowsOfSteps(cellsOf(entries));
  const brackets = opts.spans === true ? bracketsOf(model, { id: flowId, mode }, rowOf) : [];
  const gutAt = (k: number): SeqGut[] =>
    brackets.filter((b) => b.a <= k && k <= b.b).map((b) => markOf(model, b, k));
  const parts = sm.parts.map((id, i) => partOf(model, mode, { id, col: i + ctx.off }));
  const names = [
    ...(sm.actor === null ? [] : [{ name: sm.actor, mono: false }]),
    ...parts.map((p) => ({ name: p.name, mono: p.store })),
  ];
  return {
    flowId,
    title: chipInfo(model, flowId).label,
    mode,
    cols: ctx.cols,
    dense: isDense(ctx.cols),
    tier: columnTier(names, ctx.cols),
    person: sm.actor,
    parts,
    lanes: brackets.reduce((n, b) => Math.max(n, b.lane + 1), 0),
    items: treeOf(entries, (d, k) => cellOf(ctx, d, { at: k, gut: gutAt(k) })),
    key: brackets.map((b) => keyOf(model, b)),
  };
}
