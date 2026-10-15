import type { Model } from '@/application/plan/derive';
import type { ElementStatus } from '@/application/plan/derive-core';
import { type FlowMode, type FlowStep, stepKind } from '@/application/plan/flow-steps';
import { prop } from '@/application/plan/ids';
import { chipInfo } from '@/application/plan-chips';
import { viaLabel } from '@/application/plan-viz-map';
import type { Draft } from '@/application/plan-viz-sequence-rows';
import {
  type Place,
  type Tone,
  between,
  fromCentre,
  pillOf,
  plainText,
  toCentre,
} from '@/application/plan-viz-sequence-text';

// Pass 2 of a sequence drawing: each cell as the words and places the components draw.

export interface Ctx {
  readonly model: Model;
  readonly mode: FlowMode;
  readonly cur: ReadonlySet<number>;
  /** Steps before the first current one have been walked. */
  readonly curMin: number;
  /** 1 when a person starts the flow and so has the first column, else 0. */
  readonly off: number;
  readonly cols: number;
  readonly participants: readonly string[];
  readonly markers: Readonly<Record<string, string>>;
  readonly markerTitle: string;
  /** Changed steps wear a pill saying how: not in today's view, and not on a flow that is new as a whole. */
  readonly pills: boolean;
}

/** One bracket of a test over the steps, as it shows on one row. */
export interface SeqGut {
  readonly n: number;
  readonly test: string;
  readonly level: string;
  readonly lane: number;
  readonly pos: 'only' | 'first' | 'mid' | 'last';
  readonly title: string;
  readonly label: string;
}

export interface SeqArrow {
  readonly kind: 'api' | 'msg' | 'data' | 'reply' | 'enter';
  readonly place: Place;
  /** Points to the left. */
  readonly rev: boolean;
  /** The label overhangs to the left, where there is room. */
  readonly toLeft: boolean;
  readonly label: string;
  /** What the label opens in the inspector; '' for none. */
  readonly ref: string;
  readonly title: string;
}

export interface SeqRec {
  readonly id: string;
  readonly label: string;
  readonly verb: 'w' | 'r';
  readonly title: string;
}

export interface SeqSelf {
  readonly place: Place;
  /** The box sits left of its lifeline, its stores reading toward the left. */
  readonly left: boolean;
  readonly stores: readonly { id: string; label: string; title: string }[];
}

/** Where a cell sits: its number among the cells and the test brackets that run past it. */
export interface Where {
  readonly at: number;
  readonly gut: readonly SeqGut[];
}

type Base = Where;

export interface SeqStep extends Base {
  readonly kind: 'step';
  readonly index: number;
  readonly id: string;
  readonly action: string;
  readonly status: ElementStatus;
  readonly walk: 'current' | 'walked' | '';
  /** The step goes where no step goes today. */
  readonly isNew: boolean;
  readonly arrow: SeqArrow | null;
  readonly self: SeqSelf | null;
  readonly see: { readonly ref: string; readonly label: string } | null;
  readonly pill: { readonly tone: Tone; readonly text: string } | null;
  readonly marker: string | null;
  readonly recs: readonly SeqRec[];
  readonly logic: string;
}

export type SeqCell =
  | (Base & { readonly kind: 'group'; readonly tab: string })
  | (Base & { readonly kind: 'else'; readonly text: string })
  | (Base & { readonly kind: 'link'; readonly role: 'enter' | 'reply'; readonly arrow: SeqArrow })
  | (Base & { readonly kind: 'trigger'; readonly text: string; readonly place: Place })
  | SeqStep;

const label = (model: Model, id: string): string => chipInfo(model, id).label;
const baseId = (id: string): string => id.split('#')[0] ?? id;

/** Stores behind a list of record ids (fields resolve to their schema). */
function storesOf(model: Model, refs: readonly string[]): string[] {
  const out = new Set<string>();
  for (const r of refs) {
    const store = prop(model.get(baseId(r)), 'store');
    if (typeof store === 'string') out.add(store);
  }
  return [...out];
}

function recOf(model: Model, id: string, verb: 'w' | 'r'): SeqRec {
  const name = label(model, baseId(id));
  const store = prop(model.get(baseId(id)), 'store');
  const where = typeof store === 'string' ? ` in ${label(model, store)}` : '';
  return { id, label: name, verb, title: `${verb === 'w' ? 'Writes' : 'Reads'} ${name}${where}` };
}

function arrowOf(
  ctx: Ctx,
  [from, to]: readonly [number, number],
  a: Pick<SeqArrow, 'kind' | 'label' | 'ref' | 'title'>,
) {
  const arrow: SeqArrow = {
    ...a,
    place: between(from, to),
    rev: to < from,
    toLeft: Math.min(from, to) + Math.max(from, to) + 1 > ctx.cols,
  };
  return arrow;
}

const column = (ctx: Ctx, id: string): number => ctx.participants.indexOf(id) + ctx.off;

/** What an unnamed step says on its arrow. */
function plainVerb(kind: string, s: FlowStep): string {
  if (kind !== 'data') return '';
  return (s.writes ?? []).length > 0 ? 'write' : 'read';
}

function stepArrow(ctx: Ctx, s: FlowStep): SeqArrow {
  const kind = stepKind(ctx.model, s);
  const named = s.via !== '' && s.via !== 'internal';
  // the full signature or event name: the label wraps, it is never cut
  const text = named ? viaLabel(ctx.model, s.via, 400) : plainVerb(kind, s);
  return arrowOf(ctx, [column(ctx, s.from), column(ctx, s.to)], {
    kind: kind === 'internal' ? 'data' : kind,
    label: text,
    ref: named ? s.via : '',
    title: named ? label(ctx.model, s.via) : text,
  });
}

function selfOf(ctx: Ctx, s: FlowStep): SeqSelf {
  const col = column(ctx, s.from);
  const writes = s.writes ?? [];
  const writing = writes.length > 0;
  const left = col >= ctx.cols / 2 && ctx.cols > 2;
  return {
    place: left ? toCentre(col) : fromCentre(col),
    left,
    stores: storesOf(ctx.model, writing ? writes : (s.reads ?? [])).map((id) => ({
      id,
      label: label(ctx.model, id),
      title: `${writing ? 'Writes to' : 'Reads from'} ${label(ctx.model, id)}`,
    })),
  };
}

function walkOf(ctx: Ctx, i: number): SeqStep['walk'] {
  if (ctx.cur.has(i)) return 'current';
  return i < ctx.curMin ? 'walked' : '';
}

function statusOfStep(ctx: Ctx, s: FlowStep): ElementStatus {
  if (s.$removed === true) return 'removed';
  return ctx.mode === 'asIs' ? 'existing' : (ctx.model.status(s.id) ?? 'existing');
}

const isNewVia = (ctx: Ctx, s: FlowStep): boolean =>
  ctx.mode !== 'asIs' &&
  s.via !== '' &&
  s.via !== 'internal' &&
  ctx.model.status(s.via) === 'added';

function stepCell(ctx: Ctx, d: Extract<Draft, { type: 'step' }>, where: Where): SeqStep {
  const s = d.row.step;
  const status = statusOfStep(ctx, s);
  const writes = s.writes ?? [];
  const screen = d.see === null ? null : baseId(d.see);
  const named = ctx.pills ? pillOf(status) : null;
  return {
    kind: 'step',
    ...where,
    index: d.i,
    id: s.id,
    action: s.action,
    status,
    walk: walkOf(ctx, d.i),
    isNew: isNewVia(ctx, s),
    arrow: s.from === s.to ? null : stepArrow(ctx, s),
    self: s.from === s.to ? selfOf(ctx, s) : null,
    see: screen === null ? null : { ref: screen, label: label(ctx.model, screen) },
    pill: named === null ? null : { tone: named[0], text: named[1] },
    marker: ctx.markers[s.id] ?? null,
    recs: [
      ...writes.map((id) => recOf(ctx.model, id, 'w')),
      ...(s.reads ?? [])
        .filter((id) => !writes.includes(id))
        .map((id) => recOf(ctx.model, id, 'r')),
    ],
    logic: s.logic ?? '',
  };
}

/** A cell as the words and places it is drawn with. */
export function cellOf(ctx: Ctx, d: Draft, where: Where): SeqCell {
  switch (d.type) {
    case 'group': {
      return { kind: 'group', ...where, tab: d.tab };
    }
    case 'else': {
      return { kind: 'else', ...where, text: plainText(ctx.model, d.text) };
    }
    case 'enter': {
      const arrow = arrowOf(ctx, [0, column(ctx, d.to)], {
        kind: 'enter',
        label: d.label,
        ref: '',
        title: d.label,
      });
      return { kind: 'link', ...where, role: 'enter', arrow };
    }
    case 'trigger': {
      return {
        kind: 'trigger',
        ...where,
        text: plainText(ctx.model, d.text),
        place: fromCentre(ctx.off),
      };
    }
    case 'reply': {
      const arrow = arrowOf(ctx, [column(ctx, d.from), column(ctx, d.to)], {
        kind: 'reply',
        label: d.label,
        ref: d.ref,
        title: `What the call answers: ${d.label}`,
      });
      return { kind: 'link', ...where, role: 'reply', arrow };
    }
    case 'step': {
      return stepCell(ctx, d, where);
    }
  }
}
