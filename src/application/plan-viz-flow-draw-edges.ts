import type { Model } from '@/application/plan/derive';
import { type FlowMode, type FlowStep, isNewLink } from '@/application/plan/flow-steps';
import type { DrawnEdge, DrawnLabel, DrawnRow, Walker } from '@/application/plan-viz-flow-drawn';
import { arrowHead, roundPath } from '@/application/plan-viz-flow-geometry';
import {
  type FlowEdge,
  type FlowItem,
  actionOf,
  stateNote,
  stepState,
} from '@/application/plan-viz-flow-graph';
import type { Routed } from '@/application/plan-viz-flow-route';
import { LINE } from '@/application/plan-viz-flow-size';
import { plainTitle } from '@/shared/plain-text';

/** What the drawing needs besides the graph. */
export interface DrawCtx {
  readonly model: Model;
  readonly mode: FlowMode;
  readonly walk: Walker;
  readonly markers: Readonly<Record<string, string>>;
}

const plan = (ctx: DrawCtx): boolean => ctx.mode !== 'asIs';
const label = (ctx: DrawCtx) => (id: string) => ctx.model.label(id);

/** ` · writes order · reads cart`: the records a step touches. */
export function recordNote(model: Model, s: FlowStep): string {
  const named = (list: readonly string[] | undefined): string =>
    [...new Set((list ?? []).map((r) => model.label(r.split('#')[0] ?? '')))].join(', ');
  return [
    ['writes', named(s.writes)],
    ['reads', named(s.reads)],
  ]
    .filter(([, names]) => names !== '')
    .map(([verb, names]) => ` · ${verb ?? ''} ${names ?? ''}`)
    .join('');
}

/** What a step says of itself apart from what it does: only a deprecated step has words. */
export const statusNote = (ctx: DrawCtx, s: FlowStep): string =>
  stateNote(stepState(ctx.model, ctx.mode, s));

const edgeState = (ctx: DrawCtx, e: FlowEdge): DrawnEdge['state'] => {
  const items = e.items.filter((it) => it.implicit !== true && it.fan !== true);
  if (!plan(ctx) || items.length === 0) return '';
  if (items.every((it) => it.s.$removed === true)) return 'removed';
  const live = items.filter((it) => it.s.$removed !== true);
  return live.every((it) => isNewLink(ctx.model, it.s)) ? 'added' : '';
};

const viasOf = (e: FlowEdge): string[] => [
  ...new Set(e.items.map((it) => it.s.via).filter((v) => v !== '' && v !== 'internal')),
];

function edgeOf(ctx: DrawCtx, { e, pts }: Routed): DrawnEdge {
  const d = roundPath(pts);
  const title = e.items.map((it) => `${String(it.i + 1)}. ${it.text}`).join('\n');
  const first = e.items[0];
  const via = first?.s.via ?? '';
  const opens = first?.implicit !== true && via !== '' && via !== 'internal';
  const steps = e.items.map((it) => it.i);
  const ends = `${ctx.model.label(e.from)} → ${ctx.model.label(e.to)}`;
  return {
    key: e.key,
    kind: e.kind,
    from: e.from,
    to: e.to,
    walk: ctx.walk.loudest(steps),
    implicit: e.items.every((it) => it.implicit === true),
    state: edgeState(ctx, e),
    steps,
    ref: opens ? via : (first?.s.id ?? e.from),
    vias: viasOf(e),
    title,
    aria: `${ends}: ${title.replaceAll('\n', '; ')}`,
    d,
    pts: [...pts],
    head: arrowHead(pts),
  };
}

function describe(ctx: DrawCtx, it: FlowItem, members: readonly FlowItem[]): string {
  const name = (m: FlowItem) => plainTitle(actionOf(m.s), label(ctx));
  if (members.length > 1) return `${it.text} during ${members.map(name).join(' and ')}`;
  const note = statusNote(ctx, it.s);
  const tail = note === '' ? '' : ` · ${note}`;
  const words = plainTitle(actionOf(it.s), label(ctx));
  return `Step ${String(it.i + 1)}: ${words}${recordNote(ctx.model, it.s)}${tail}`;
}

function numberOf(it: FlowItem, first: boolean): string | null {
  if (!first || it.implicit === true) return null;
  return `${String(it.i + 1)}${it.letter ?? ''}`;
}

function markOf(ctx: DrawCtx, it: FlowItem, first: boolean): string | null {
  if (!first || it.fan === true) return null;
  const marks = (it.members ?? [it]).map((m) => ctx.markers[m.s.id]);
  return marks.find((m) => m !== undefined && m !== '') ?? null;
}

function rowsOf(ctx: DrawCtx, e: FlowEdge, top: number): DrawnRow[] {
  return e.lines.map((l, k) => {
    const members = l.it.members ?? [l.it];
    const grouped = members.length > 1;
    const state =
      l.it.implicit === true || l.it.fan === true ? '' : stepState(ctx.model, ctx.mode, l.it.s);
    return {
      text: l.t,
      first: l.first,
      implicit: l.it.implicit === true,
      walk: grouped ? ctx.walk.loudest(members.map((m) => m.i)) : ctx.walk.of(l.it.i),
      state: plan(ctx) ? state : '',
      number: numberOf(l.it, l.first),
      lettered: l.it.letter !== undefined,
      description: describe(ctx, l.it, members),
      step: grouped ? null : l.it.i,
      steps: members.map((m) => m.i),
      ref: grouped ? e.to : l.it.s.id,
      mark: markOf(ctx, l.it, l.first),
      y: top + k * LINE,
    };
  });
}

function labelOf(
  ctx: DrawCtx,
  { e, r }: Routed & { readonly r: NonNullable<Routed['r']> },
): DrawnLabel {
  const steps = [...new Set(e.lines.flatMap((l) => (l.it.members ?? [l.it]).map((m) => m.i)))];
  return {
    key: e.key,
    kind: e.kind,
    from: e.from,
    to: e.to,
    steps,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    rows: rowsOf(ctx, e, r.y + 2 + LINE / 2 + 1),
  };
}

/** The arrows and the labels riding on them. */
export function drawEdges(
  ctx: DrawCtx,
  routed: readonly Routed[],
): { readonly edges: readonly DrawnEdge[]; readonly labels: readonly DrawnLabel[] } {
  const labels: DrawnLabel[] = [];
  for (const x of routed) {
    if (x.r !== null) labels.push(labelOf(ctx, { ...x, r: x.r }));
  }
  return { edges: routed.map((x) => edgeOf(ctx, x)), labels };
}
