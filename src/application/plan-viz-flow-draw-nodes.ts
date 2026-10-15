import type { Model } from '@/application/plan/derive';
import type { FlowStep } from '@/application/plan/flow-steps';
import { prop } from '@/application/plan/ids';
import { type DrawCtx, recordNote, statusNote } from '@/application/plan-viz-flow-draw-edges';
import type {
  DrawnBody,
  DrawnEndpoint,
  DrawnEvent,
  DrawnNode,
  DrawnSelf,
} from '@/application/plan-viz-flow-drawn';
import { clipText, shortTopic } from '@/application/plan-viz-flow-geometry';
import { type FlowNodeSpec, actionOf, stepState, storeOf } from '@/application/plan-viz-flow-graph';
import { HEAD, MONO, ROW, sigOf } from '@/application/plan-viz-flow-size';
import { teamIndex } from '@/application/plan-viz-teams';
import { plainTitle } from '@/shared/plain-text';

const GLYPH: Record<string, [glyph: string, word: string]> = {
  service: ['▣', 'SERVICE'],
  ui: ['◧', 'UI'],
  job: ['⏱', 'JOB'],
  external: ['◇', 'EXTERNAL'],
};
const STORE_WORD: Record<string, string> = { cache: 'CACHE', blob: 'BLOB', search: 'SEARCH' };
const UNKNOWN_TEAM = 8;
const SELF_LINE = 14;
const EVENT_LINE = 16;
const CHAR = 6.3;

const plan = (ctx: DrawCtx): boolean => ctx.mode !== 'asIs';
const kindOfEntity = (model: Model, id: string): string => {
  const kind = prop(model.get(id), 'kind');
  return typeof kind === 'string' ? kind : '';
};

function endpointsOf(ctx: DrawCtx, n: FlowNodeSpec): DrawnEndpoint[] {
  return n.endpoints.map((ep, k) => {
    const sig = sigOf(ctx.model, ep.via);
    const summary = prop(ctx.model.get(ep.via), 'summary');
    const words =
      typeof summary === 'string' ? plainTitle(summary, (id) => ctx.model.label(id)) : '';
    return {
      via: ep.via,
      text: clipText(sig, Math.floor((n.w - 30) / MONO)),
      title: words === '' ? `API: ${sig}` : `API: ${sig} — ${words}`,
      aria: `API: ${sig}`,
      added: plan(ctx) && ctx.model.status(ep.via) === 'added',
      cy: HEAD + k * ROW + ROW / 2,
    };
  });
}

function selvesOf(ctx: DrawCtx, n: FlowNodeSpec, name: string): DrawnSelf[] {
  let y = HEAD + n.endpoints.length * ROW;
  return n.selfs.map(({ i, s, lines }) => {
    const cy = y + ROW / 2;
    y += ROW + (lines.length - 1) * SELF_LINE;
    const note = statusNote(ctx, s);
    const tail = note === '' ? '' : ` · ${note}`;
    const words = plainTitle(actionOf(s), (id) => ctx.model.label(id));
    return {
      step: i,
      id: s.id,
      lines,
      cy,
      walk: ctx.walk.of(i),
      state: plan(ctx) ? stepState(ctx.model, ctx.mode, s) : '',
      title: `Step ${String(i + 1)} (inside ${name}): ${words}${recordNote(ctx.model, s)}${tail}`,
      aria: `Step ${String(i + 1)}: ${actionOf(s)}${tail}`,
      mark: ctx.markers[s.id] ?? null,
    };
  });
}

function eventsOf(ctx: DrawCtx, n: FlowNodeSpec): DrawnEvent[] {
  return n.events.map((id, k) => {
    const full = ctx.model.label(id);
    const text = clipText(full, 28);
    const textX = n.w / 2 + 6;
    return {
      id,
      text,
      title: full,
      added: plan(ctx) && ctx.model.status(id) === 'added',
      y: n.ph + 18 + k * EVENT_LINE,
      iconX: textX - (text.length * CHAR) / 2 - 14,
      textX,
    };
  });
}

function bodyOf(ctx: DrawCtx, n: FlowNodeSpec, name: string): DrawnBody {
  if (n.kind === 'topic') {
    return { kind: 'topic', ph: n.ph, nameLines: n.nameLines, events: eventsOf(ctx, n) };
  }
  const what = kindOfEntity(ctx.model, n.id);
  if (n.kind === 'store') {
    return {
      kind: 'store',
      word: STORE_WORD[what] ?? 'DATABASE',
      name: clipText(shortTopic(name), 22),
    };
  }
  const [glyph, word] = GLYPH[what] ?? GLYPH.service ?? ['▣', 'SERVICE'];
  return {
    kind: 'service',
    what: what in GLYPH ? what : 'service',
    glyph,
    word,
    endpoints: endpointsOf(ctx, n),
    selfs: selvesOf(ctx, n, name),
  };
}

/** The systems the shown steps are between, and the records they read and write. */
export function touchedBy(model: Model, steps: readonly (FlowStep | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const s of steps) {
    if (s === undefined) continue;
    out.add(s.from);
    out.add(s.to);
    for (const r of [...(s.reads ?? []), ...(s.writes ?? [])]) {
      const store = storeOf(model, r);
      if (store !== null) out.add(store);
    }
  }
  return out;
}

export interface NodeFilters {
  touched: ReadonlySet<string>;
  lens: string | undefined;
}

export function drawNodes(
  ctx: DrawCtx,
  nodes: Iterable<FlowNodeSpec>,
  { touched, lens }: NodeFilters,
): DrawnNode[] {
  return [...nodes].map((n) => {
    const team = ctx.model.ownerTeam(n.id);
    const name = ctx.model.label(n.id);
    const status = plan(ctx) ? ctx.model.status(n.id) : null;
    return {
      id: n.id,
      kind: n.kind,
      name,
      x: n.x,
      y: n.y,
      w: n.w,
      h: n.h,
      state: status === 'added' || status === 'modified' ? status : '',
      touched: touched.has(n.id),
      lensOff: lens !== undefined && team !== lens,
      team: team === null ? UNKNOWN_TEAM : teamIndex(ctx.model, team),
      mark: ctx.markers[n.id] ?? null,
      body: bodyOf(ctx, n, name),
    };
  });
}
